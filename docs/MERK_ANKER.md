# VIBEZCORE — MERK-ANKER (DEFINITIEF — hoort in de PROJECTKENNIS)

> **WAAROM DIT BESTAAT.** Tot nu toe werden documenten in losse chats gemaakt
> en gingen ze verloren zodra een chat vol was — waardoor alles telkens opnieuw
> uitgelegd moest worden, zelfs mét handover. Dit document lost dat op voor één
> specifiek onderdeel: **font, kleuren, logo, look-and-feel.**
>
> **WAT JE ÉÉN KEER DOET:** zet dit bestand in de **projectkennis** van het
> project "Vibezcore audio library app" — dezelfde plek als de handover, de
> spec v2.3 en de structuurdocumenten. Daarna is dit in ELKE nieuwe chat
> automatisch beschikbaar. Nooit meer opnieuw uitzoeken. Nooit meer uitleggen.
>
> **INSTRUCTIE AAN ELKE TOEKOMSTIGE CHAT:** dit is bindend voor alles wat met
> uiterlijk te maken heeft. Niet opnieuw onderzoeken, niet in twijfel trekken,
> niet "opnieuw extraheren uit de webapp". Het staat hieronder. Toepassen.

---

## SCOPE — alleen uiterlijk

Dit anker gaat UITSLUITEND over **font, kleuren, logo en look-and-feel**.
Het zegt bewust NIETS over app-structuur, tab-indeling, of welke schermen er
zijn. Dat zijn losse operator-beslissingen en vallen hier buiten.

Bron: geëxtraheerd uit de echte VIBEZCORE-webapp (`sign-in.html`,
`app.vibezcore.com`). Dit is het BESTAANDE merk — geen nieuw ontwerp.

---

## 1. FONT

- **Inter** — gewichten 400, 500, 600, 700, 800, 900.
- Webapp laadt via Google Fonts:
  `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap`
- Native (Expo): gebruik `@expo-google-fonts/inter`, of Inter `.ttf` in
  `assets/fonts`. Zonder dit valt de app terug op systeemfont — dat is de
  reden dat de huidige native build er "kaal/lelijk" uitziet.

## 2. KLEURENPALET

> **GEWIJZIGD 26 september 2026 (operator):** de oorspronkelijke tabel hieronder
> beschreef `#3a8fff` (Signal Blue) als "primair accent (knoppen, links, actieve
> tab)" — dat was fout en is de bron geweest van herhaalde correcties in de app
> zelf. Signal Blue is STRIKT gereserveerd voor haptic-pulsen en "nu actief" in
> de player — nooit voor knoppen, tekst of vlakken. Bron van waarheid is voortaan
> `src/constants/theme.ts`, niet deze tabel of de webapp-extractie. Onderstaande
> tabel is bijgewerkt om dat te weerspiegelen.

| Rol | Hex | Gebruik |
|---|---|---|
| Achtergrond (app-breed, dark — nu DEFAULT theme, zie §7) | `#0a0a0a` | — |
| Achtergrond (light-variant, niet-default) | `#F5F5F7` | — |
| Signal Blue | `#3a8fff` | UITSLUITEND haptic-pulsen / "nu actief" in de player. Nooit CTA/tekst/vlakken. |
| Royal Indigo (Light) | `#6E85C4` (op dark) / `#1E2A4A` (op light) | Accent-tekst/labels/links — nooit knop-achtergronden. |
| Bio-Teal (Audio Library-scoped) | `#00A3A3` / `#4AF0D4` | Accent binnen de Audio Library-ervaring (player, mini-player, library-schermen) — nog NIET app-breed. |
| Succes (groen) | `#4ade80` (dark) / `#16a34a` (light) | — |
| Fout (rood) | `#ef4444` (dark) / `#dc2626` (light) | — |
| Paneel / kaart | `#1e1e1e` (dark) / `#ffffff` (light) | — |
| Rand / divider | `#2a2a2a` (dark) / `#e5e5ea` (light) | — |
| Tekst primair | `#f4f4f4` (dark) / `#1D1D1F` (light) | — |
| Tekst gedimd | `#8a8a8a` (dark) / `#8E8E93` (light) | — |

**CTA-knop-chrome (v4.4, losstaand van accentkleur):** donkere achtergrond →
witte knop + donkere tekst; lichte achtergrond → zwarte/Royal-Indigo knop +
witte tekst. De CTA-achtergrond is NOOIT de accentkleur zelf.

De 5 bracelet-modus-kleuren (Boost=amber, Sharp Focus=blauw, Calm Control=violet,
Clarity & Relax=wit, Sleep=WhatsApp-groen) komen uit CLAUDE.md §5 — zie die tabel
voor de actuele, herhaaldelijk bijgestelde exacte hex-waardes.

## 3. LOGO

Twee varianten bestaan al. Ze worden los bijgeleverd als bestanden
(`vibezcore_wordmark.png`, `vibezcore_icon.png`) én als base64-tekstbestanden,
zodat een chat ze direct in code kan zetten zonder iets opnieuw te zoeken.

| Variant | Wat | Gebruik |
|---|---|---|
| Wordmark | Wit "VIBEZCORE", breed/hoekig, dunne open letters, transparant | Schermkoppen — vervangt platte tekst "VIBEZCORE" |
| Icoon | Witte gestileerde "V" op zwart `#0a0a0a` | App-icoon + compacte plekken |

Regel: **VIBEZCORE altijd in HOOFDLETTERS**, ook in lopende tekst.

> De volledige base64-strings zijn lang (wordmark ~37k tekens, icoon ~3k) en
> staan in de meegeleverde bestanden `wordmark_base64.txt` en `icon_base64.txt`.
> Zet die mee in de projectkennis, of bewaar de PNG's in `assets/` van de
> native app. Zo hoeft het logo nooit opnieuw uit de webapp geëxtraheerd te
> worden.

## 4. LOOK & FEEL

- Donkere achtergrond `#0a0a0a`, hoog contrast, witte tekst — dit is sinds
  26 september 2026 de DEFAULT theme van de app (niet meer light-default).
- Strak, modern, royale spacing — geen drukke UI.
- Accentgebruik is nu rol-gesplitst i.p.v. één blauw overal — zie §2:
  Signal Blue alleen haptic-pulsen, Royal Indigo alleen tekst/labels,
  Bio-Teal alleen binnen Audio Library.
- Grote vette koppen (Inter 800/900), rustige bodytekst (Inter 400/500).
- Beeldmateriaal mag groot en sfeervol (hero-stijl); tekst wordt NIET meer
  standaard over foto's geplaatst (zie de "Content-Card"-regel — tekst
  onder een foto, los op de pagina-achtergrond) — een klein, zacht label
  (bv. "Pillar 0X") mag nog wel als subtiele scrim op de foto zelf staan.

## 5. DIRECT TOEPASBAAR — concrete eerste stappen (geen beslissing nodig)

1. Inter-font laden (package of asset) → font-probleem opgelost.
2. Eén centraal thema-/kleurbestand met de hex uit §2 → losse kleuren weg.
3. `vibezcore_wordmark.png` in schermkoppen i.p.v. platte tekst → logo opgelost.
4. App-icoon = `vibezcore_icon.png`.

Dit visuele inbouwwerk is iteratief en gaat het soepelst met **Claude Code**
(ziet de projectbestanden, past ze zelf aan, direct resultaat) — niet via
handmatig copy-paste in een chat. Maar de SPECIFICATIE hierboven is compleet
en blijft gelden, ongeacht welk gereedschap het uitvoert.

---

## 6. NIET door een chat invullen (blijft operator-beslissing)

Dit anker legt het UITERLIJK vast. De volgende INHOUD is GEEN onderdeel hiervan
en mag niet verzonnen worden door een chat:
- Schermteksten, gast-first uitleg, Account-teksten
- Bracelet-etalage / marketingverhaal
- Definitieve modus-namen
- Wetenschaps-/marketingclaims (toestand-taal, geen hersengolf-claims)
