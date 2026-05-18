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

## 2. KLEURENPALET (exact uit de webapp — bindend)

| Rol | Hex |
|---|---|
| Achtergrond (app-breed, dark theme) | `#0a0a0a` |
| Primair accent (knoppen, links, actieve tab) | `#3a8fff` |
| Accent hover / pressed | `#2a7fee` |
| Succes (groen) | `#4ade80` |
| Fout (rood) | `#ef4444` |
| Paneel / kaart | `#1e1e1e` |
| Rand / divider | `#2a2a2a` |
| Tekst primair | `#f4f4f4` |
| Tekst gedimd (bijschriften) | ~`#8a8a8a` (webapp gebruikt opacity op #f4f4f4) |

De 5 bracelet-modus-kleuren (Boost=rood, Sharp Focus=oranje, Calm Control=blauw,
Clarity=paars, Rest & Reset=groen) komen uit het structuurdocument §3 en mogen
binnen dit palet getint worden. Exacte modus-hex = latere fijnafstemming.

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

## 4. LOOK & FEEL (uit app.vibezcore.com)

- Donkere achtergrond `#0a0a0a`, hoog contrast, witte tekst.
- Strak, modern, royale spacing — geen drukke UI.
- Blauw (`#3a8fff`) spaarzaam als accent (labels, actieve staat, knoppen).
- Grote vette koppen (Inter 800/900), rustige bodytekst (Inter 400/500).
- Beeldmateriaal mag groot en sfeervol (hero-stijl), tekst eroverheen wit.

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
