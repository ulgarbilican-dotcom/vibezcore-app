// Generates the two Kickstarter "Reserve your spot" info columns for the Wix pages
// /subscribe-bracelet and /subscribe-bundle (the email form next to it is a native Wix form).
// Content, prices and package contents mirror the Early Bird packages on /shop.
// Usage: node scripts/gen-website-subscribe.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'website-pages');

const PACKAGES = {
  bracelet: {
    file: 'subscribe-bracelet.html',
    title: 'Reserve Your Smart Bead Bracelet — VIBEZCORE',
    name: 'Smart Bead Bracelet',
    meta: 'HapticCore · 15 gemstone editions · 5 states',
    sub: 'Reserve the Kickstarter Early Bird price for the Smart Bead Bracelet. Just your email, no payment.',
    price: {
      USD: { now: '$169', was: '$299', save: 'Save $130 · 43% off · early backers only' },
      EUR: { now: '€149', was: '€299', save: 'Save €150 · 50% off · early backers only' },
      GBP: { now: '£149', was: '£259', save: 'Save £110 · 42% off · early backers only' },
    },
    included: [
      ['Smart Bead Bracelet', 'with HapticCore, in 15 natural gemstones'],
      ['State Control', '5 states in the VIBEZCORE app'],
      ['State Control on phone and smartwatch', 'Apple Watch and Wear OS'],
    ],
  },
  bundle: {
    file: 'subscribe-bundle.html',
    title: 'Reserve the Full Bundle — VIBEZCORE',
    name: 'Full Bundle',
    meta: 'Bracelet + Breathwork + State Control + Audio Library',
    sub: 'The bracelet, plus a year of VIBEZCORE Premium: Breathwork, State Control and the full Audio Library. Reserve the Early Bird price with just your email.',
    price: {
      USD: { now: '$215', was: '$400.99', save: 'Save $185.99 · 46% off · early backers only' },
      EUR: { now: '€199', was: '€398.99', save: 'Save €199.99 · 50% off · early backers only' },
      GBP: { now: '£179', was: '£345.99', save: 'Save £166.99 · 48% off · early backers only' },
    },
    included: [
      ['Smart Bead Bracelet', 'with HapticCore, in 15 natural gemstones'],
      ['VIBEZCORE Premium, 1 year', 'Breathwork, State Control on phone and smartwatch, and the full Audio Library'],
      ['Extra bead set', 'interchangeable'],
    ],
    // Same value breakdown as the Full Bundle card on /shop; Premium = the app's all-in yearly price.
    value: [
      ['Smart Bead Bracelet', { USD: '$299', EUR: '€299', GBP: '£259' }],
      ['VIBEZCORE Premium, 1 year', { USD: '$69.99', EUR: '€69.99', GBP: '£59.99' }],
      ['Extra bead set', { USD: '$32', EUR: '€30', GBP: '£27' }],
      ['Early Bird discount', { USD: '−$185.99', EUR: '−€199.99', GBP: '−£166.99' }],
    ],
  },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const attrs = (key, p) =>
  ['USD', 'EUR', 'GBP'].map((c) => `data-${c.toLowerCase()}="${esc(p[c][key])}"`).join(' ');

const CHECK =
  '<svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7L5.5 10.5L12 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function page(pkg) {
  const p = pkg.price;
  const included = pkg.included
    .map(([b, s]) => `    <li><span class="ic">${CHECK}</span><span><strong>${esc(b)}</strong> — ${esc(s)}</span></li>`)
    .join('\n');
  const value = pkg.value
    ? `
<div class="rv d4">
  <h2>Value breakdown</h2>
  <div class="value">
${pkg.value
  .map(([n, v]) => `    <div${n.startsWith('Early') ? ' class="disc"' : ''}><span>${esc(n)}</span><span data-usd="${esc(v.USD)}" data-eur="${esc(v.EUR)}" data-gbp="${esc(v.GBP)}">${esc(v.USD)}</span></div>`)
  .join('\n')}
    <div class="tot"><span>Your price</span><span ${attrs('now', p)}>${esc(p.USD.now)}</span></div>
  </div>
</div>
`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pkg.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--head:#f5f5f7;--body:#a1a1a6;--label:#86868b;--card:#161617;--line:#2a2a2a;--acc:#00A3A3;--acc-2:#4AF0D4}
html,body{background:transparent;color:var(--head);font-family:Inter,-apple-system,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;text-size-adjust:100%;overflow:hidden !important;scrollbar-width:none}
html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}
body{padding:36px 32px;max-width:400px}
@media(max-width:600px){body{padding:28px 18px;max-width:100%}}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.rv{opacity:0;animation:rise .55s cubic-bezier(.16,1,.3,1) forwards}
.d1{animation-delay:.05s}.d2{animation-delay:.12s}.d3{animation-delay:.19s}.d4{animation-delay:.26s}.d5{animation-delay:.33s}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.pill{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:6px 13px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.pill.ks{color:var(--acc-2);background:rgba(0,163,163,.10);border:1px solid rgba(0,163,163,.28)}
.pill.ks i{width:5px;height:5px;border-radius:50%;background:currentColor;animation:blink 1.6s ease infinite}
.pill.free{color:var(--head);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);letter-spacing:.06em;text-transform:none;font-size:11px;font-weight:600}
h1{font-size:38px;font-weight:700;letter-spacing:-.035em;line-height:1.04;margin-bottom:12px}
@media(max-width:400px){h1{font-size:30px}}
.sub{font-size:16px;color:var(--body);line-height:1.55;margin-bottom:22px}
.cur{display:inline-flex;gap:2px;padding:3px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);margin-bottom:14px}
.cur button{border:0;background:none;cursor:pointer;font:inherit;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--label);padding:7px 14px;min-width:58px;border-radius:999px;transition:color .18s,background .18s}
.cur button.on{background:#fff;color:#0a0a0a}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px 20px 18px;margin-bottom:10px}
.lbl{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--label);margin-bottom:8px}
.name{font-size:17px;font-weight:700;margin-bottom:3px}
.meta{font-size:12.5px;color:var(--label);margin-bottom:14px}
.row{display:flex;align-items:baseline;gap:10px;font-variant-numeric:tabular-nums}
.now{font-size:36px;font-weight:700;letter-spacing:-.03em;line-height:1}
.was{font-size:14px;color:var(--label);text-decoration:line-through}
.save{display:inline-block;margin-top:10px;font-size:12px;font-weight:600;color:var(--acc-2)}
.note{font-size:11.5px;color:var(--label);line-height:1.5;margin-bottom:24px}
h2{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--label);margin-bottom:12px}
ul{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:26px}
li{display:flex;gap:11px;align-items:flex-start;font-size:14px;line-height:1.45;color:var(--body)}
li strong{color:var(--head);font-weight:600}
.ic{width:20px;height:20px;flex-shrink:0;margin-top:1px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--acc-2);background:rgba(0,163,163,.12);border:1px solid rgba(0,163,163,.28)}
.value{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 16px;margin-bottom:26px;font-variant-numeric:tabular-nums}
.value div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;font-size:13.5px;color:var(--body);border-bottom:1px solid var(--line)}
.value div:last-child{border-bottom:0}
.value .disc span:last-child{color:var(--acc-2)}
.value .tot{color:var(--head);font-weight:700}
.steps{display:flex;flex-direction:column;gap:8px;margin-bottom:22px}
.step{display:flex;align-items:baseline;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.step b{font-size:11px;font-weight:700;color:var(--acc-2);font-variant-numeric:tabular-nums}
.step span{font-size:13.5px;font-weight:600}
.step small{margin-left:auto;font-size:12px;color:var(--label);text-align:right}
.trust{font-size:13px;color:var(--body);line-height:1.6;border-top:1px solid var(--line);padding-top:18px}
</style>
</head>
<body>

<div class="pills rv d1">
  <span class="pill ks"><i></i>Kickstarter · Early 2027</span>
  <span class="pill free">Free to reserve · No obligation</span>
</div>

<h1 class="rv d2">Reserve Your Spot</h1>
<p class="sub rv d2">${esc(pkg.sub)}</p>

<div class="cur rv d3" role="group" aria-label="Currency">
  <button type="button" data-cur="USD">$ USD</button>
  <button type="button" data-cur="EUR">&euro; EUR</button>
  <button type="button" data-cur="GBP">&pound; GBP</button>
</div>

<div class="card rv d3">
  <div class="lbl">Kickstarter Early Bird</div>
  <div class="name">${esc(pkg.name)}</div>
  <div class="meta">${esc(pkg.meta)}</div>
  <div class="row"><span class="now" ${attrs('now', p)}>${esc(p.USD.now)}</span><span class="was" ${attrs('was', p)}>${esc(p.USD.was)}</span></div>
  <span class="save" ${attrs('save', p)}>${esc(p.USD.save)}</span>
</div>
<p class="note rv d3">Kickstarter pledges are billed in USD. Regional pricing is shown for reference.</p>

<div class="rv d4">
  <h2>What’s included</h2>
  <ul>
${included}
  </ul>
</div>
${value}
<div class="steps rv d4">
  <div class="step"><b>01</b><span>Reserve</span><small>Today. No payment.</small></div>
  <div class="step"><b>02</b><span>Get notified</span><small>Before the campaign opens.</small></div>
  <div class="step"><b>03</b><span>Campaign opens</span><small>Early 2027.</small></div>
</div>

<p class="trust rv d5">Kickstarter only charges if the funding goal is reached. Early Bird pricing is for early backers during the campaign and subject to availability.</p>

<script>
(function(){
  function detect(){
    var tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}
    var loc=(navigator.language||'').toLowerCase();
    if(tz==='Europe/London'||tz==='Europe/Belfast'||loc.indexOf('en-gb')===0)return 'GBP';
    if(tz.indexOf('Europe/')===0||tz==='Atlantic/Canary'||tz==='Atlantic/Madeira'||tz==='Atlantic/Azores')return 'EUR';
    return 'USD';
  }
  function apply(cur){
    var a='data-'+cur.toLowerCase();
    document.querySelectorAll('[data-usd]').forEach(function(el){el.textContent=el.getAttribute(a);});
    document.querySelectorAll('.cur button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-cur')===cur);});
  }
  document.querySelectorAll('.cur button').forEach(function(b){b.addEventListener('click',function(){apply(b.getAttribute('data-cur'));});});
  apply(detect());
}());
</script>
</body>
</html>
`;
}

// Hero above the reserve column, in the same style as the other pages' heroes (Audio Library #b01:
// white, eyebrow with live dot, Inter 700 headline, grey sub, photo as a rounded card below).
const HERO_IMG = 'https://static.wixstatic.com/media/63ceef_5a250d10d4394e87b32c7826e1bd8fd6~mv2.jpg';
const hero = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reserve Your Spot — VIBEZCORE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="${HERO_IMG}">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;color:#1D1D1F;font-family:Inter,-apple-system,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;text-size-adjust:100%;overflow:hidden !important;scrollbar-width:none}
html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}
.hero{padding:120px 0 96px}
.wrap{max-width:1200px;margin:0 auto;padding:0 56px}
.eyebrow{display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:12px;font-weight:700;letter-spacing:1.5px;line-height:1.33;text-transform:uppercase}
.eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:#1D1D1F;animation:live 2.4s ease-in-out infinite}
@keyframes live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}
h1{font-size:88px;font-weight:700;line-height:1.03;letter-spacing:-.025em;text-wrap:balance}
h1 span{display:block;white-space:nowrap}
.sub{margin-top:24px;font-size:28px;font-weight:500;line-height:1.3;letter-spacing:-.01em;color:#6E6E73}
.img{margin-top:72px;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#F5F5F7}
.img img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 30%}
.rv{opacity:0;transform:translateY(30px);transition:opacity 1.2s cubic-bezier(.25,1,.5,1),transform 1.2s cubic-bezier(.25,1,.5,1)}
.rv.on{opacity:1;transform:none}
@media(max-width:1023px) and (min-width:769px){.hero{padding:96px 0 80px}.wrap{padding:0 40px}h1{font-size:68px}.sub{font-size:24px}.img{margin-top:56px}}
@media(max-width:768px){.hero{padding:64px 0 56px}.wrap{padding:0 24px}.eyebrow{font-size:11px}
h1{font-size:min(40px,calc((100vw - 48px) / 7.6));line-height:1.1;letter-spacing:-.4px}
.sub{margin-top:16px;font-size:17px;font-weight:400;line-height:1.45;letter-spacing:0}
.img{margin-top:32px;aspect-ratio:4/5;border-radius:14px}.img img{object-position:40% 30%}}
@media(prefers-reduced-motion:reduce){.rv{opacity:1;transform:none;transition:none}.eyebrow::before{animation:none}}
</style>
</head>
<body>
<section class="hero"><div class="wrap">
  <span class="eyebrow rv">Kickstarter &middot; Early 2027</span>
  <h1 class="rv"><span>Stay in control.</span> <span>Start here.</span></h1>
  <p class="sub rv">Reserve your spot and relax.</p>
  <div class="img rv"><img src="${HERO_IMG}" alt="Man relaxing with eyes closed on a sofa" loading="eager"></div>
</div></section>
<script>
document.querySelectorAll('.rv').forEach(function(el,i){setTimeout(function(){el.classList.add('on')},80+i*120)});
</script>
</body>
</html>
`;
writeFileSync(join(OUT, 'subscribe-hero.html'), hero, 'utf8');
console.log('wrote subscribe-hero.html');

for (const pkg of Object.values(PACKAGES)) {
  writeFileSync(join(OUT, pkg.file), page(pkg), 'utf8');
  console.log('wrote', pkg.file);
}
