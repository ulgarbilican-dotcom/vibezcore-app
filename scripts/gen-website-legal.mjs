/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — webpagina's voor de juridische teksten, gemaakt uit de app

   Eén bron (src/data/legal-content.ts): de site toont exact dezelfde tekst
   als de app (operator, 29 okt 2026: website en app liepen uit elkaar —
   privacy van juni, voorwaarden van maart met 16+ i.p.v. 13+, …). Opmaak =
   de bestaande Wix-pagina's van de operator (zelfde kleuren, inhoudstafel,
   mobiel menu, automatische hoogte voor de Wix-embed).

   Gebruik:  node scripts/gen-website-legal.mjs
   Uitvoer:  docs/website-pages/legal/<slug>.html — één bestand per document,
             te plakken in het HTML-blok van de juiste Wix-pagina.
   ───────────────────────────────────────────────────────────────────────── */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'src', 'data', 'legal-content.ts');
const OUT = path.join(ROOT, 'docs', 'website-pages', 'legal');

/* Een app-bestand laden zoals de app het ziet op platform `os` (react-native = enkel Platform; '@/…' = src/…). */
function loadModule(file, os, cache = new Map()) {
  if (cache.has(file)) return cache.get(file);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod.exports);
  vm.runInNewContext(js, {
    module: mod,
    exports: mod.exports,
    require: (name) => {
      if (name === 'react-native') return { Platform: { OS: os } };
      if (name.startsWith('@/')) {
        const base = path.join(ROOT, 'src', name.slice(2));
        const hit = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((f) => fs.existsSync(f));
        if (hit) return loadModule(hit, os, cache);
      }
      throw new Error(`gen-website-legal: onverwachte import ${name}`);
    },
  });
  cache.set(file, mod.exports);
  return mod.exports;
}

/* legal-content.ts met Platform.OS = 'web' (zie WEB daar: Apple én Google). */
const { LEGAL_DOCS, LEGAL_ORDER, SUPPORT_URL } = loadModule(SRC, 'web');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* Inline markup zoals de app-renderer: **vet** en [tekst](url). */
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_top" rel="noopener">$1</a>');

function block(b) {
  switch (b.kind) {
    case 'p':
      return `      <p>${inline(b.text)}</p>`;
    case 'h3':
      return `      <h3>${inline(b.text)}</h3>`;
    case 'ul':
      return `      <ul class="rights-list">\n${b.items.map((i) => `        <li>${inline(i)}</li>`).join('\n')}\n      </ul>`;
    case 'tags':
      return `      <div class="tag-grid">\n${b.items.map((i) => `        <span class="tag">${inline(i)}</span>`).join('\n')}\n      </div>`;
    case 'cards':
      return `      <div class="card-grid">\n${b.items
        .map((c) => `        <div class="card">\n          <h4>${inline(c.title)}</h4>\n          <p>${inline(c.text)}</p>\n        </div>`)
        .join('\n')}\n      </div>`;
    case 'highlight':
    case 'danger':
      return `      <div class="${b.kind}">\n${b.title ? `        <h4>${inline(b.title)}</h4>\n` : ''}        <p>${inline(b.text)}</p>\n      </div>`;
    default:
      throw new Error(`gen-website-legal: onbekend blok ${b.kind}`);
  }
}

const CONTACT_BTN = `      <a href="${SUPPORT_URL}" target="_top" rel="noopener" class="contact-btn">
        Support Center
        <svg width="24" height="10" viewBox="0 0 24 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 5h21M17 1l5 4-5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>`;

function page(doc) {
  /* Blokken vóór de eerste h2 = ongenummerde inleiding; elke h2 opent een genummerde sectie (zoals de app: 01, 02, …). */
  const intro = [];
  const sections = [];
  for (const b of doc.blocks) {
    if (b.kind === 'h2') sections.push({ title: b.text, blocks: [] });
    else if (sections.length === 0) intro.push(b);
    else sections[sections.length - 1].blocks.push(b);
  }
  const hasContact = sections.length > 0 && /contact/i.test(sections[sections.length - 1].title);
  if (!hasContact) sections.push({ title: 'Contact', blocks: [{ kind: 'p', text: 'Questions about this page or the VIBEZCORE platform? Our support team is here to help.' }] });

  const nav = sections.map((s, i) => `      <button class="sidebar-link" data-target="s${i + 1}">${inline(s.title)}</button>`).join('\n');
  const introHtml = intro.length
    ? `    <section class="section" id="s0" style="padding-top:0;border-bottom:none;padding-bottom:24px;">\n${intro.map(block).join('\n')}\n    </section>\n\n`
    : '';
  const body = sections
    .map((s, i) => {
      const last = i === sections.length - 1;
      return `    <section class="section" id="s${i + 1}"${last ? ' style="border-bottom:none;padding-bottom:0;"' : ''}>
      <p class="section-number">${String(i + 1).padStart(2, '0')}</p>
      <h2>${inline(s.title)}</h2>
${s.blocks.map(block).join('\n')}${last ? `\n${CONTACT_BTN}` : ''}
    </section>`;
    })
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(doc.title)} — VIBEZCORE</title>
<!-- Gemaakt uit de app (src/data/legal-content.ts) met scripts/gen-website-legal.mjs. Niet met de hand aanpassen: wijzig de app-tekst en maak opnieuw. -->
<style>
${CSS}
</style>
</head>
<body>

<nav>
  <span class="nav-tag">${esc(doc.title)}</span>
</nav>

<div class="hero">
  <span class="hero-label">Legal</span>
  <h1>${esc(doc.title)}</h1>
${doc.subtitle ? `  <p class="hero-sub">${inline(doc.subtitle)}</p>\n` : ''}</div>

<div class="page-wrap">

  <aside class="sidebar">
    <p class="sidebar-label">Contents</p>
    <button class="mobile-toggle" id="contentsToggle">
      Contents
      <svg class="mobile-toggle-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="sidebar-nav" id="sidebarNav">
${nav}
    </div>
  </aside>

  <main class="content">

    <div class="date-badge">Last updated: ${esc(doc.lastUpdated)}</div>

${introHtml}${body}

  </main>
</div>

<script>
${SCRIPT}
</script>

</body>
</html>
`;
}

/* Opmaak = de bestaande pagina's van de operator (privacy.html, 29 okt 2026), plus .danger voor de crisis-box van Health. */
const CSS = `  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; overflow-wrap: break-word; }
  html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
  :root {
    --white: #ffffff; --black: #1d1d1f; --gray-100: #f5f5f7; --gray-200: #e8e8ed; --gray-400: #86868b;
    --gray-600: #515154; --blue: #0071e3; --blue-hover: #0077ed; --radius: 12px;
  }
  html { scroll-behavior: smooth; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: var(--white); color: var(--black); -webkit-font-smoothing: antialiased; line-height: 1.6; }
  nav { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.85); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--gray-200); display: flex; align-items: center; justify-content: space-between; padding: 0 48px; height: 52px; }
  .nav-tag { font-size: 12px; color: var(--gray-400); letter-spacing: 0.02em; }
  .hero { text-align: center; padding: 100px 24px 72px; max-width: 800px; margin: 0 auto; }
  .hero-label { display: inline-block; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--blue); margin-bottom: 20px; }
  .hero h1 { font-size: clamp(36px, 5vw, 56px); font-weight: 700; letter-spacing: -1.5px; line-height: 1.07; color: var(--black); margin-bottom: 20px; }
  .hero-sub { font-size: 17px; color: var(--gray-400); line-height: 1.6; }
  .page-wrap { max-width: 1080px; margin: 0 auto; padding: 0 48px 120px; display: grid; grid-template-columns: 220px 1fr; gap: 64px; align-items: start; }
  .sidebar { position: sticky; top: 72px; }
  .sidebar-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-400); margin-bottom: 16px; padding-left: 12px; }
  .sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
  .sidebar-link { display: block; width: 100%; padding: 8px 12px; font-size: 13px; color: var(--gray-600); text-decoration: none; border-radius: 6px; transition: background 0.15s, color 0.15s; line-height: 1.4; background: none; border: none; cursor: pointer; text-align: left; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
  .sidebar-link:hover { background: var(--gray-100); color: var(--black); }
  .sidebar-link.active { background: var(--gray-100); color: var(--black); font-weight: 500; }
  .content { min-width: 0; }
  .date-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gray-100); border-radius: 20px; padding: 6px 14px; font-size: 13px; color: var(--gray-600); margin-bottom: 48px; }
  .date-badge::before { content: ''; display: inline-block; width: 7px; height: 7px; background: #34c759; border-radius: 50%; }
  .section { border-bottom: 1px solid var(--gray-200); padding: 48px 0; opacity: 0; transform: translateY(16px); animation: fadeUp 0.5s forwards; }
  .section:first-of-type { padding-top: 0; }
  @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
  .section-number { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--blue); margin-bottom: 8px; }
  .section h2 { font-size: 24px; font-weight: 600; letter-spacing: -0.5px; color: var(--black); margin-bottom: 20px; line-height: 1.2; }
  .section h3 { font-size: 15px; font-weight: 600; color: var(--black); margin: 28px 0 10px; }
  .section p { font-size: 15px; color: var(--gray-600); line-height: 1.7; margin-bottom: 14px; }
  .section p:last-child { margin-bottom: 0; }
  .section a { color: var(--blue); text-decoration: none; }
  .section a:hover { text-decoration: underline; }
  .tag-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; margin-bottom: 14px; }
  .tag { background: var(--gray-100); border-radius: 20px; padding: 6px 14px; font-size: 13px; color: var(--gray-600); }
  .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 20px; margin-bottom: 14px; }
  .card { background: var(--gray-100); border-radius: var(--radius); padding: 20px; }
  .card h4 { font-size: 13px; font-weight: 600; color: var(--black); margin-bottom: 4px; }
  .card p { font-size: 12px; color: var(--gray-400); margin: 0; line-height: 1.5; }
  /* Lijstpunt als blok met het vinkje absoluut links (operator-fix op health.html): met display:flex werden <strong>/<a> in een
     lijstpunt aparte flex-items en kregen ze op een smal scherm een eigen kolom. */
  .rights-list { list-style: none; margin: 16px 0 14px; }
  .rights-list li { position: relative; padding-left: 28px; margin-bottom: 10px; font-size: 14px; color: var(--gray-600); line-height: 1.6; }
  .rights-list li:last-child { margin-bottom: 0; }
  .rights-list li::before { content: ''; position: absolute; left: 0; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #e8f4fd; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M3.5 8.5l3 3 6-6' stroke='%230071e3' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-size: cover; }
  .highlight, .danger { border-radius: var(--radius); padding: 20px 24px; margin: 16px 0 14px; }
  .highlight { background: #f0f7ff; border-left: 3px solid var(--blue); }
  .danger { background: #fff2f2; border-left: 3px solid #d70015; }
  .highlight h4, .danger h4 { font-size: 13px; font-weight: 600; color: var(--black); margin-bottom: 6px; }
  .highlight p, .danger p { font-size: 14px; color: #1d1d1f; margin: 0; }
  .contact-btn { display: inline-flex; align-items: center; gap: 12px; background: var(--blue); color: #ffffff !important; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; padding: 14px 28px; border-radius: 980px; text-decoration: none !important; margin-top: 28px; transition: background 0.15s, transform 0.15s; white-space: nowrap; max-width: 100%; }
  .contact-btn:hover { background: var(--blue-hover); transform: translateY(-1px); }
  .contact-btn svg { color: #ffffff; flex-shrink: 0; }
  @media (max-width: 768px) {
    nav { padding: 0 20px; }
    .hero { padding: 60px 20px 40px; }
    .page-wrap { padding: 0 20px 16px; grid-template-columns: 1fr; gap: 0; }
    .sidebar { display: block; position: static; margin-bottom: 8px; }
    .sidebar-label { display: none; }
    .sidebar-nav { display: none; background: var(--gray-100); border-radius: var(--radius); padding: 8px; margin-top: 0; }
    .sidebar-nav.open { display: flex; }
    .mobile-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; background: var(--gray-100); border: none; border-radius: var(--radius); padding: 12px 16px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 500; color: var(--black); cursor: pointer; margin-bottom: 4px; }
    .mobile-toggle-icon { width: 16px; height: 16px; transition: transform 0.2s; color: var(--gray-400); }
    .mobile-toggle.open .mobile-toggle-icon { transform: rotate(180deg); }
    .section:last-of-type { border-bottom: none; padding-bottom: 0; }
  }
  @media (max-width: 480px) {
    .contact-btn { font-size: 12px; padding: 12px 22px; gap: 10px; letter-spacing: 0.08em; }
  }
  @media (min-width: 769px) { .mobile-toggle { display: none; } }`;

/* Links naar andere pagina's van vibezcore.com laten Wix navigeren (uit audio-sessions.html van de operator). */
const WIX_NAV = `  document.querySelectorAll('a[href^="https://www.vibezcore.com"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.parent.postMessage({ type: 'navigate', url: a.getAttribute('href') }, '*');
    });
  });`;

const SCRIPT = `  const btns = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.section[id^="s"]:not(#s0)');
  const toggle = document.getElementById('contentsToggle');
  const nav = document.getElementById('sidebarNav');
  toggle.addEventListener('click', () => { nav.classList.toggle('open'); toggle.classList.toggle('open'); });
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nav.classList.remove('open');
      toggle.classList.remove('open');
    });
  });
  function setActive() {
    let current = sections[0].id;
    sections.forEach(s => { if (s.getBoundingClientRect().top <= 120) current = s.id; });
    btns.forEach(b => b.classList.toggle('active', b.dataset.target === current));
  }
  window.addEventListener('scroll', setActive, { passive: true });
  setActive();

  /* Wix HTML-embed: stuur de echte hoogte van de inhoud door (geen witruimte, geen scrollbalk). */
  function reportHeight() {
    var wrap = document.querySelector('.page-wrap');
    var h = Math.ceil(wrap.getBoundingClientRect().bottom + (window.pageYOffset || 0)) + 8;
    try {
      window.parent.postMessage({ height: h }, '*');
      window.parent.postMessage({ type: 'hsize', height: h }, '*');
      window.parent.postMessage(h + '', '*');
    } catch (e) {}
  }
  if (document.readyState === 'complete') reportHeight();
  else window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight);
  if (window.MutationObserver) new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true, attributes: true });
${WIX_NAV}`;

/* ── FAQ (src/data/faq-content.ts) ─────────────────────────────────────────
   Twee keer geladen, als iPhone en als Android. Verschilt een antwoord, dan staan beide op de site onder hun platform; een vraag die
   maar op één platform bestaat (bv. batterij-optimalisatie op Android) krijgt dat platform in de titel. */
const FAQ_SRC = path.join(ROOT, 'src', 'data', 'faq-content.ts');
const faqIos = loadModule(FAQ_SRC, 'ios');
const faqAndroid = loadModule(FAQ_SRC, 'android');
const { FAQ_CATEGORY_ORDER, FAQ_CATEGORY_LABELS } = faqAndroid;
const iosById = new Map(faqIos.FAQ_ITEMS.map((x) => [x.id, x]));
const androidById = new Map(faqAndroid.FAQ_ITEMS.map((x) => [x.id, x]));
const allIds = [...new Set([...faqAndroid.FAQ_ITEMS.map((x) => x.id), ...faqIos.FAQ_ITEMS.map((x) => x.id)])];
const faqItems = allIds.map((id) => {
  const a = androidById.get(id);
  const i = iosById.get(id);
  const base = a ?? i;
  if (a && i && a.answer !== i.answer) {
    return { ...base, answer: `**iPhone & Apple Watch**\n${i.answer}\n\n**Android & Wear OS**\n${a.answer}` };
  }
  if (!a || !i) return { ...base, question: `${base.question} (${a ? 'Android' : 'iPhone'})` };
  return base;
});

const answerHtml = (txt) =>
  txt
    .split(/\n{2,}/)
    .map((para) => `          <p>${para.split('\n').map(inline).join('<br>')}</p>`)
    .join('\n');

function faqPage() {
  const cats = FAQ_CATEGORY_ORDER.filter((c) => faqItems.some((x) => x.category === c));
  const tabs = [`    <button onclick="filterCat(this,'all')" class="cat-btn active">All</button>`]
    .concat(cats.map((c) => `    <button onclick="filterCat(this,'${c}')" class="cat-btn">${esc(FAQ_CATEGORY_LABELS[c])}</button>`))
    .join('\n');
  const sections = cats
    .map((c) => {
      const items = faqItems
        .filter((x) => x.category === c)
        .map(
          (x) => `      <div class="faq-item" data-q="${esc(x.question)}">
        <button class="faq-q" onclick="toggle(this)">${inline(x.question)}<span class="faq-icon">+</span></button>
        <div class="faq-a">
${answerHtml(x.answer)}
        </div>
      </div>`,
        )
        .join('\n\n');
      return `    <div class="faq-section" data-cat="${c}">
      <h3 class="faq-cat-title">${esc(FAQ_CATEGORY_LABELS[c])}</h3>

${items}
    </div>`;
    })
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FAQ — VIBEZCORE</title>
<!-- Gemaakt uit de app (src/data/faq-content.ts) met scripts/gen-website-legal.mjs. Niet met de hand aanpassen: wijzig de app-tekst en maak opnieuw. -->
<style>
${FAQ_CSS}
</style>
</head>
<body>

<div class="hero">
  <span class="hero-label">VIBEZCORE</span>
  <h1>Frequently Asked<br>Questions</h1>
  <p class="hero-sub">Everything you need to know about VIBEZCORE — State Control, Breathwork, the Audio Library, your smartwatch and the Smart Bead Bracelet.</p>
</div>

<div class="page-wrap">

  <div class="search">
    <input id="faqSearch" type="text" placeholder="Search questions..." oninput="filterFAQ()" aria-label="Search questions">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
  </div>

  <div id="catTabs">
${tabs}
  </div>

  <div id="faqList">

${sections}

    <div id="noResults">
      <p>No questions found. Try a different search term.</p>
    </div>
  </div>

  <div class="support-card">
    <p>Still have a question?</p>
${CONTACT_BTN}
  </div>

</div>

<script>
(function () {
  function toggle(btn) { btn.classList.toggle('open'); btn.nextElementSibling.classList.toggle('open'); }
  function filterCat(btn, cat) {
    document.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('faqSearch').value = '';
    document.querySelectorAll('.faq-section').forEach(function (s) { s.classList.toggle('hidden', cat !== 'all' && s.dataset.cat !== cat); });
    document.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('hidden'); });
    document.getElementById('noResults').style.display = 'none';
  }
  function filterFAQ() {
    var q = document.getElementById('faqSearch').value.toLowerCase();
    document.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelector('.cat-btn').classList.add('active');
    var any = false;
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var text = item.dataset.q.toLowerCase() + item.querySelector('.faq-a').textContent.toLowerCase();
      var show = !q || text.indexOf(q) !== -1;
      item.classList.toggle('hidden', !show);
      if (show) any = true;
    });
    document.querySelectorAll('.faq-section').forEach(function (s) {
      s.classList.toggle('hidden', !s.querySelector('.faq-item:not(.hidden)'));
    });
    document.getElementById('noResults').style.display = any ? 'none' : 'block';
  }
  window.toggle = toggle; window.filterCat = filterCat; window.filterFAQ = filterFAQ;
}());

  function reportHeight() {
    var h = Math.ceil(document.querySelector('.page-wrap').getBoundingClientRect().bottom + (window.pageYOffset || 0)) + 8;
    try {
      window.parent.postMessage({ height: h }, '*');
      window.parent.postMessage({ type: 'hsize', height: h }, '*');
      window.parent.postMessage(h + '', '*');
    } catch (e) {}
  }
  if (document.readyState === 'complete') reportHeight();
  else window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight);
  if (window.MutationObserver) new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true, attributes: true });
${WIX_NAV}
</script>

</body>
</html>
`;
}

/* Opmaak = faq.html van de operator (zoekveld, categorieknoppen, uitklapvragen), zonder de productkaarten en banner met claims. */
const FAQ_CSS = `  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; overflow-wrap: break-word; }
  :root { --white: #ffffff; --black: #1d1d1f; --gray-100: #f5f5f7; --gray-200: #e8e8ed; --gray-400: #86868b; --gray-600: #515154; --blue: #0071e3; --blue-hover: #0077ed; --radius: 12px; }
  html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
  html { scroll-behavior: smooth; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: var(--white); color: var(--black); -webkit-font-smoothing: antialiased; line-height: 1.6; }
  .hero { text-align: center; padding: 72px 24px 56px; max-width: 800px; margin: 0 auto; }
  .hero-label { display: inline-block; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--blue); margin-bottom: 20px; }
  .hero h1 { font-size: clamp(36px, 5vw, 56px); font-weight: 700; letter-spacing: -1.5px; line-height: 1.07; color: var(--black); margin-bottom: 20px; }
  .hero-sub { font-size: 17px; color: var(--gray-400); line-height: 1.6; }
  .page-wrap { max-width: 800px; margin: 0 auto; padding: 0 24px 80px; }
  .search { position: relative; margin-bottom: 32px; }
  .search input { width: 100%; padding: 14px 20px 14px 44px; border: 1px solid var(--gray-200); border-radius: 980px; font-family: inherit; font-size: 15px; color: var(--black); background: var(--gray-100); outline: none; appearance: none; }
  .search input:focus { background: #fff; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(0,113,227,0.12); }
  .search svg { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
  #catTabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 48px; }
  .cat-btn { background: var(--gray-100); border: none; border-radius: 980px; padding: 8px 16px; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--gray-600); cursor: pointer; transition: background 0.15s, color 0.15s; }
  .cat-btn:hover { background: var(--gray-200); }
  .cat-btn.active { background: var(--black); color: #fff; }
  .faq-cat-title { font-size: 13px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--gray-400); margin: 48px 0 16px; }
  .faq-section:first-child .faq-cat-title { margin-top: 0; }
  .faq-item { border-bottom: 1px solid var(--gray-200); }
  .faq-q { width: 100%; background: none; border: none; padding: 20px 0; display: flex; justify-content: space-between; align-items: center; gap: 16px; font-family: inherit; font-size: 15px; font-weight: 500; color: var(--black); cursor: pointer; text-align: left; -webkit-tap-highlight-color: transparent; }
  .faq-q:hover { color: var(--blue); }
  .faq-icon { flex-shrink: 0; font-size: 20px; font-weight: 300; color: var(--gray-400); transition: transform 0.2s; line-height: 1; }
  .faq-q.open .faq-icon { transform: rotate(45deg); color: var(--blue); }
  .faq-a { display: none; padding: 0 0 20px; }
  .faq-a.open { display: block; }
  .faq-a p { font-size: 14px; color: var(--gray-600); line-height: 1.75; margin-bottom: 10px; }
  .faq-a p:last-child { margin-bottom: 0; }
  .faq-a a { color: var(--blue); text-decoration: none; }
  .faq-a a:hover { text-decoration: underline; }
  .faq-a strong { color: var(--black); font-weight: 600; }
  .faq-section.hidden, .faq-item.hidden { display: none; }
  #noResults { display: none; text-align: center; padding: 60px 0; color: var(--gray-400); font-size: 15px; }
  .support-card { text-align: center; padding-top: 40px; }
  .support-card p { font-size: 15px; color: var(--gray-600); margin-bottom: 4px; }
  .contact-btn { display: inline-flex; align-items: center; gap: 12px; background: var(--blue); color: #ffffff !important; font-family: inherit; font-size: 14px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; padding: 14px 28px; border-radius: 980px; text-decoration: none; margin-top: 20px; transition: background 0.15s, transform 0.15s; white-space: nowrap; }
  .contact-btn:hover { background: var(--blue-hover); transform: translateY(-1px); }
  .contact-btn svg { color: #fff; flex-shrink: 0; }
  @media (max-width: 640px) {
    .hero { padding: 40px 20px 32px; }
    .page-wrap { padding: 0 16px 60px; }
    #catTabs { gap: 6px; }
    .cat-btn { font-size: 12px; padding: 7px 12px; }
    .faq-cat-title { margin-top: 32px; }
    .contact-btn { font-size: 12px; padding: 12px 22px; gap: 10px; letter-spacing: 0.08em; }
  }`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'faq.html'), faqPage(), 'utf8');
console.log(`faq.html  (${faqItems.length} vragen)`);
for (const slug of LEGAL_ORDER) {
  const doc = LEGAL_DOCS[slug];
  fs.writeFileSync(path.join(OUT, `${slug}.html`), page(doc), 'utf8');
  console.log(`${slug}.html  (${doc.blocks.length} blokken)`);
}
