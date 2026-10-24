# FLOWS — State Control (volledige lijst, Free én Premium)

> 24 oktober 2026. Dit is de checklist achter `scripts/flows.py`. Een onderdeel is pas "klaar" als **elke regel hieronder ✅ is én slaagt**.
> Status: ✅ geautomatiseerd in `flows.py` · ⏳ nog niet geautomatiseerd (dus NIET gemeten) · ➖ niet van toepassing in die toestand.
> Volgorde van werken: Free van boven naar onder, pas bij volledig PASS → Premium. Eén FAIL = eerst herstellen, dan dit onderdeel opnieuw vanaf het begin.

## A. Eerste gebruik (nieuwe gebruiker: `qa?fresh=1`)
| ID | Flow en verwacht resultaat | Free | Premium |
|---|---|---|---|
| A1 | Tab openen → intro "The Power to Shift" met tabbalk en knop "Explore State Control" | ⏳ | ➖ (geen intro) |
| A2 | "Explore State Control" → onboarding stap 1 (principe) | ⏳ | ⏳ |
| A3 | Onboarding: door alle stappen met Next; Back per stap gaat één stap terug; "Not Now"/terug op stap 1 → uitstel, daarna gewone pagina | ⏳ | ⏳ |
| A4 | Onboarding afronden → rusthartslag-keuze ("Your Resting Heart Rate") → gemiddelde kiezen → keuzescherm | ⏳ | ⏳ |
| A5 | Tweede keer tab openen: onboarding verschijnt niet meer | ⏳ | ⏳ |

## B. Keuzescherm (picker)
| ID | Flow en verwacht resultaat | Free | Premium |
|---|---|---|---|
| B1 | Keuzescherm zonder tabbalk, met Back; hartslag-pil, cirkel, 5 dots, Quick Chill/Boost, start-knop | ✅ | ✅ |
| B2 | Dot tikken → toestand gewisseld, standaardduur klopt (Boost 10 · Sharp 15 · Calm 18 · Clarity 25 · Sleep 30) | ✅ | ✅ |
| B3 | Op de cirkel vegen (links/rechts) wisselt van toestand; dots volgen | ⏳ | ⏳ |
| B4 | Duur slepen op de rand: waarde binnen min/max van die toestand; "Recommended"/zone-label klopt | ⏳ | ⏳ |
| B5 | (i) bij de toestandsnaam opent het infoblad; Done/Close sluit; terug op de picker | ⏳ | ⏳ |
| B6 | Hartslag-pil → ritmeblad opent; Cancel sluit; gekozen waarde blijft | ⏳ | ⏳ |
| B7 | Quick Chill / Quick Boost: Free = infoblad met Start/Back · Premium = start meteen | ⏳ | ⏳ |
| B8 | Kalender-icoon → "Your daily plan"; Back komt terug op de picker | ⏳ | ⏳ |
| B9 | Back: Free → intro mét tabbalk · Premium → hoofdtabblad mét tabbalk | ✅ | ✅ |

## C. Voorproef en gratis sessie (Free)
| ID | Flow en verwacht resultaat | Free | Premium |
|---|---|---|---|
| C1 | "Start 30-second preview" opent het voorproef-blad (niet meteen een sessie); sluiten → terug op picker | ✅ | ➖ |
| C2 | Voorproef starten → loopt 30 s met Audio & Haptics-balk en "End Preview" | ⏳ | ➖ |
| C3 | Tijdens de voorproef pauzeren/hervatten werkt; minimaliseren (indien aangeboden) laat hem doorlopen | ⏳ | ➖ |
| C4 | Voorproef na 30 s: eindigt vanzelf → saleskaart (glas) met Subscribe / Not now; Not now → picker | ⏳ | ➖ |
| C5 | "End Preview" voortijdig: stopt, geen saleskaart-lus | ⏳ | ➖ |
| C6 | Eerste gratis sessie (indien beschikbaar): start, loopt, eindigt netjes | ⏳ | ➖ |
| C7 | Saleskaart: Day Pass / Monthly / Yearly kiezen, Subscribe (tot aan het Play-venster), Restore, Terms/Privacy openen en sluiten | ⏳ | ➖ |

## D. Sessie (Premium; in Free na aankoop)
| ID | Flow en verwacht resultaat | Free | Premium |
|---|---|---|---|
| D1 | Start → (ritmeblad indien hartslag nog niet gekozen) → sessiescherm loopt | ➖ | ✅ |
| D2 | Pauzeren → "PAUSED"; hervatten → loopt weer | ➖ | ✅ |
| D3 | Minimaliseren → picker met sessie-pil; pil → sessie weer open | ➖ | ✅ |
| D4 | Tijdens sessie van toestand wisselen: "Switch to …" → bevestigingspopup → bevestigen = nieuwe sessie, annuleren = oude loopt door | ➖ | ⏳ |
| D5 | "Audio & Haptics"-blad opent en sluit (Done); wijzigingen blijven | ➖ | ⏳ |
| D6 | End session → bevestiging → stopt, pil weg, picker | ➖ | ✅ |
| D7 | Sessie loopt tot het einde: eindscherm/bevestigingsmoment, daarna picker | ➖ | ⏳ |
| D8 | Tab wisselen tijdens een lopende sessie: pil blijft zichtbaar op andere tabs; pil brengt terug | ➖ | ⏳ |
| D9 | App naar achtergrond en terug: sessie loopt door (timer klopt) | ➖ | ⏳ |
| D10 | Back op picker met lopende sessie stopt de sessie NIET | ➖ | ⏳ |

## E. Overig binnen State Control
| ID | Flow en verwacht resultaat | Free | Premium |
|---|---|---|---|
| E1 | Haptiek-ritme tijdens sessie: interval en duur binnen tolerantie (logcat-meting) | ⏳ | ⏳ |
| E2 | Daily plan → agenda: dag/ring, toestand-kaarten openen, "Set your plan" → bracelet-set-day → opslaan → terug | ⏳ | ⏳ |
| E3 | Plan-herinneringen/notificaties openen de juiste bestemming | ⏳ | ⏳ |
| E4 | Horloge: sessie start/stopt op het horloge (alleen met gekoppeld horloge) | ➖ geen horloge | ➖ geen horloge |

## F. Per scherm: elke terugknop en elke CTA (aanvulling 24 okt)
Voor ELK scherm/blad hierboven (intro, onboarding-stappen, hartslagpagina, picker, voorproef-blad, voorproef, saleskaart, sessie, "Switch to"-popup, Audio & Haptics-blad, infoblad, ritmeblad, agenda, set-your-plan) geldt:

| ID | Controle | Meting |
|---|---|---|
| F1 | Elke terugknop/sluitknop bestaat, is zichtbaar en brengt je op het **verwachte vorige scherm** (niet een ander tabblad, niet "niets") | app meldt pad/vlag vóór en ná de tik |
| F2 | Elke CTA heeft de **juiste tekst** voor de toestand (Free/Premium, gekozen toestand, wel/niet eerste keer) | tekst/naam uit het meetpunt |
| F3 | Elke CTA is **inactief vóór de vereiste keuze en actief erna** (zoals "Next" in de Breath-onboarding) | meetpunt meldt `disabled`; plus pixelhelderheid op de knop: actief licht, inactief donker |
| F4 | Een tik op een CTA doet precies **één ding** en leidt naar het verwachte volgende scherm (geen dubbele navigatie, geen stilte) | pad/vlag vóór en ná |
| F5 | Een inactieve CTA doet bij tikken **niets** behalve de bedoelde "dit kan nog niet"-schudbeweging | pad ongewijzigd |
| F6 | CTA-uiterlijk volgens de regels (witte pil of glas in toestandskleur, 52 dp, 26 dp marge) | pixelmeting op de knop |

Status F1–F6: ⏳ (nog niet geautomatiseerd; het meetpunt moet daarvoor `disabled` per knop melden — in aanbouw).

**Dekking nu:** zie de uitvoer van `python scripts/flows.py <serial> <free|premium> --coverage` (telt ✅ tegenover totaal).
