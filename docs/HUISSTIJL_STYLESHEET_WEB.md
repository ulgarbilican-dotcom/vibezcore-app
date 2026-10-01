# VIBEZCORE — Huisstijl (web + app), dark-only

## 1. Kleuren

| Rol | Hex | Gebruik |
|---|---|---|
| Achtergrond | `#0a0a0a` | Enige achtergrond, overal |
| Paneel / kaart | `#1e1e1e` | Kaarten, panelen, modals |
| Rand / divider | `#2a2a2a` | Dunne randen, scheidingslijnen |
| Tekst primair | `#f4f4f4` | Koppen, body |
| Tekst gedimd | `#8a8a8a` | Labels, muted tekst, subheaders |
| **Bio-Teal** | **`#00A3A3` / `#4AF0D4`** | **DE accentkleur, overal in de app** — eyebrows, badges, links, actieve-kaart-randen, progress-fills |
| Signal Blue | `#3a8fff` | UITSLUITEND haptic-pulsen / "nu actief". Nooit tekst, links, knoppen, vlakken. |
| Calm Control-paars | `#B478FF` | Uitsluitend die ene bracelet-modus |
| Succes | `#4ade80` | — |
| Fout | `#ef4444` | — |
| Wit | `#FFFFFF` | CTA-vulling (zie §3) |

Royal Indigo / "Royal Indigo Light" (`#1E2A4A` / `#6E85C4`) bestaat niet
meer als accentkleur — volledig vervangen door Bio-Teal.

## 2. Typografie

Font: Inter, gewichten 400/500/600/700/800/900.

### 2A. Desktop (web)

| Rol | Grootte | Gewicht | Letter-spacing |
|---|---|---|---|
| H1 (grote kop) | 58px | Bold (700) | -0.5px |
| H2 (sectiekop) | 28px | Bold (700) | -0.3px |
| Body | 18px | Regular (400) | normal |
| Eyebrow (label) | 12px | Bold (700) | +1.5px, ALL CAPS |
| CTA-knoptekst | 17px | SemiBold (600) | normal |
| Subheader/muted | 16px | Regular (400) | — (kleur `#8a8a8a`) |

### 2B. Mobiel (web + app)

| Rol | Grootte | Gewicht | Letter-spacing |
|---|---|---|---|
| H1 (grote kop) | 32–40px | Bold (700) | -0.4px |
| H2 (sectiekop) | 22px | Bold (700) | -0.3px |
| Body | 15px | Regular (400) | normal |
| Eyebrow (label) | 11px | Bold (700) | +1.5px, ALL CAPS |
| CTA-knoptekst | 17px | SemiBold (600) | normal |
| Subheader/muted | 15px | Regular (400) | — (kleur `#8a8a8a`) |

Mobiele H1 groeit mee tot 40px op bredere telefoons, krimpt alleen als de
langste regel anders niet past (`min(40px, calc((100vw - 48px) / 8.2))`
op web); de native app gebruikt een vaste 32px (geen viewport-afhankelijke
schaal nodig, schermbreedtes liggen dicht bij elkaar).

**Regels (beide):**
- ALL CAPS uitsluitend voor eyebrows van maximaal 2–3 woorden. Een kop of
  sectiekop die een volledige zin is: normale zinsbouw (Sentence case).
- Geen decoratieve leestekens — geen streepjes rond labels (`— BUILT ON —`),
  geen tekst-pijltjes als navigatie/procesindicator
  (`Understanding → Awareness`). Dat wordt een echte component: chips of
  een pijl-icoon, nooit een los leesteken in de zin.
- Regelval: een kop/subkop/body die over meerdere regels loopt vormt een
  rustig blok (bovenste en onderste regel ~even lang, nooit één los woord
  op de laatste regel). Twee zinnen → de tweede begint op een nieuwe regel.
  Techniek: `text-wrap: balance` (koppen) + `text-wrap: pretty` (body).

## 3. Componenten

**Kaarten:** `border-radius: 14px` (app) / `16px` (web-productkaarten).
Padding minimaal 16–20px, nooit knellend. Achtergrond `#1e1e1e`, rand
`#2a2a2a`.

**Foto-kaarten:** tekst staat NIET op de foto — titel/sessietal/label staan
los op de achtergrond, direct onder de foto (Content-Card-patroon). Een
klein, zacht label (bv. "Pillar 01") mag als subtiele scrim bovenaan de
foto zelf staan — nooit de hoofdtekst.

**CTA-knop:** altijd wit (`#FFFFFF`) met donkere tekst (`#1D1D1F`).
Radius 14px, geen rand nodig op app (1px `#D2D2D7` op web). Hover
(desktop web): `#E8E8ED`. Indrukken: `scale(.97)` + `opacity: .85`. Nooit
Signal Blue, Royal Indigo of een gradient als CTA-vulling.

**Tekstlinks (web):** wit, 15px (mobiel 16px), Medium. "Learn more" + pijl
→ (5px los). Hover: onderlijn + pijl 4px naar rechts, 200ms.

**Badges:** mogen wel een accentkleur dragen (Signal Blue voor status,
Calm-paars voor die modus) — het zijn geen primaire acties.

## 4. Haptische puls

Sonar-ring-animatie: 3 geschakelde ringen, 2.4s, curve
`cubic-bezier(.2,.6,.4,1)`, gedelayed 0/0.75s/1.5s, plus een gloeiende
kernstip. Altijd Signal Blue — de enige plek waar die kleur oplicht.

## 5. Animaties

**Bij het openen van een pagina/scherm:**
- Staggered fade-up: elk element fade + 20–30px omhoog, curve
  `cubic-bezier(.25,1,.5,1)`, één keer, nooit lussend.
  Timing: titel 0ms → subkop 200ms → beeld 400ms → CTA 600ms.
- Hero-foto: schaalt bij binnenkomst van 96–108% naar 100% (samen met de
  fade-up hierboven, niet als los effect) — geeft direct gevoel van diepte.

**Kaarten (grids/lijsten):**
- Elke kaart fade + lichte scale-in (0.95–0.98 → 1.0), gestaggerd
  0/50/100/150ms na elkaar (linksboven eerst bij een grid).
- Selectie (bv. pricing-kaart, actieve pillar): snelle klik-animatie —
  `scale(.95)` tijdens de tik, licht overshootend terug naar `1.02` bij
  loslaten (spring, geen harde stop op 1.0), rand kleurt in met de
  accentkleur.
- **Kaart-naar-detailscherm (bv. tik op een pillar-kaart):** geen platte
  scherm-transitie — de fotokaart zelf groeit vloeiend uit naar de randen
  van het nieuwe scherm, de titel-tekst beweegt mee naar zijn plek
  bovenaan de detailpagina (shared-element transition). Duur ~350–450ms,
  zelfde curve als de binnenkomst-animaties.

**Knoppen:**
- Hover (desktop): kleurverschuiving, 200ms.
- Indrukken: `scale(.97)` + `opacity: .85`.

**Foto's:**
- Losse foto-kaart: langzame inzoom bij verschijnen/hover, 700ms
  ease-out, scale 1.05–1.08 → 1.0.
- Productbeelden op scroll: zoom 108% → 100% naar het midden van het
  scherm terwijl de gebruiker scrollt.

**Tekst/font:**
- Kopregel bij binnenkomst: fade + translateY 10px, evt. gecombineerd
  met een lichte blur (2–3px) die in 300ms scherptrekt (focus-in-effect)
  — alleen op de hoofdkop van een scherm, niet overal.
- Langere bodytekst: woord-voor-woord onthullen, gekoppeld aan scrollen
  (omkeerbaar bij terugscrollen) — voor lange uitlegblokken, niet voor
  korte labels/eyebrows.
- **Scroll-in-view reveal (secties verderop op de pagina):** een blok dat
  pas in beeld komt bij scrollen (bv. een quote-sectie) licht zachtjes op
  van gedimd (`opacity: 0.2`) naar vol (`opacity: 1.0`) i.p.v. los te faden
  vanaf 0 — voelt trager en intentioneler bij lange scroll-pagina's.
- Tekstlink-hover: onderlijn klapt uit vanuit het midden + pijl 4px.

**Overig:**
- Tellers/cijfers: tellen één keer op bij binnenkomst, geen loop.
- Status-stip ("Available now" e.d.): ademende puls, 2.4s cyclus.
- **CTA-tik → haptiek:** een tik op de primaire CTA geeft een lichte
  haptic-selection-tik op het moment van indrukken (los van de
  visuele `scale(.97)`). Alleen wanneer een sessie/player daadwerkelijk
  start, mag een status-indicator morphen naar het Signal-Blue
  wave-effect uit §4 — nooit bij een gewone CTA-tap zonder sessie-start.
- Haptische puls: zie §4 (Signal Blue, sonar-ringen).
- Alles uit bij `prefers-reduced-motion`.

## 6. Verticaal ritme

| Afstand | Desktop | Mobiel |
|---|---|---|
| Kop → subkop (één samenhangend blok) | 24px | 16px |
| Vóór de eerstvolgende kaarten-sectie | 144px | 80px |
| Tussen secties | 128px | 80px |

## 7. Bronbestanden (app)

`src/constants/theme.ts` (`BrandDark`, `TypeScale`/`AppTypeScale`, `CTA`),
`src/data/breath-states.ts` (modus-kleuren). Deze tabel is een spiegel van
die bestanden — bij een wijziging daar, wijzigt deze tabel mee.
