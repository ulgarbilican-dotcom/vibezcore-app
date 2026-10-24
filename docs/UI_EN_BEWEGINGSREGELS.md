# VIBEZCORE — UI- en bewegingsregels (bindend, 23 oktober 2026)

> Doel (operator): ultra premium, consistentie is key, alles vloeiend. Elke opmerking is een regel voor de HELE app.
> Bron van waarheid in code: `src/constants/theme.ts` (CTA, stateGlass), `src/constants/motion.ts` (veren),
> `src/components/Tap.tsx`, `PopupCard.tsx`, `PremiumNote.tsx`, `VibezGlass.tsx`. Wijzig regels hier én daar.

## 1. Knoppen (CTA)
- Eén maat voor elke hoofdknop: **52 dp hoog, 26 dp marge links/rechts, volledig ronde pil**. Intro-, keuze-, onboarding- en popupknoppen gelijk.
- Neutraal = **wit glas**: `CTA_GLASS` (wit, 94%), tekst donker `#0a0a0a`. Grijs leest als "inactief".
- Toestandskleur (Breath-keuze, Breathwork-instel, State Control-start, Switch, lopende-sessie-balk) = `VibezGlass` (grijs
  doorschijnend glas als de iconenbalk) met de toestandskleur als tint, witte tekst. Geen verloop, geen gloed, geen rand.
- Uitgeschakeld = donker vlak `CTA.disabled`, gedimde tekst. Nooit een aparte stijl per scherm.
- Intro's: de glans-veeg over de knop blijft (dun en zacht), enkel zichtbaar zolang het tabblad in beeld is.

## 2. Koppen en tabbladen
- Titel (BREATHWORK / AUDIO LIBRARY / STATE CONTROL): klein, gespatieerd, hoofdletters (13 dp, Inter bold, letterSpacing 1,2),
  gecentreerd, direct onder de statusbalk (`insets.top + 4`). Terug en kalender/zoek staan op dezelfde rij.
- Premium-pil: **onder** de titel (`insets.top + 36`) op pagina's met titel; **bovenaan** (`insets.top + 8`) op intro-foto's.
  Zie `utils/premium-pill-slot.ts` (elk tabblad zet bij focus waar de pil staat).
- Iconenbalk (Breath-keuze) en de CTA eronder zijn even breed. Toestandsnaam klein, boven de balk.
- Premium-regel onderaan een startknop: "Full session with" + **kroon-pil Premium**, op één lijn (`PremiumNote`).

## 3. Intro's en onboarding
- Free: eerste keer de onboarding van het tabblad, daarna bij elk bezoek de intro van het tabblad. **Premium ziet geen tab-intro's.**
- De drie intro-knoppen (State Control, Breath, Library) staan op exact dezelfde plek en hebben dezelfde maat.

## 4. Sessies
- Een sessie is pas **actief na de eerste Play/Start**. Daarvoor: geen minimaliseer-chevron, geen pil, terug = vorige pagina
  (Breathwork: X; State Control-preview: wacht op Play, 0:30 staat stil).
- Play-knop overal in dezelfde stijl: rond 72 dp, toestandskleur (55%), glans bovenin, dunne lichte rand.

## 5. Audio Library
- Balk: Your Journey · Last Listened · Favorites, met dunne lijn-icoontjes. **Last Listened** = enkel de laatst beluisterde
  audio (ook als ze helemaal is uitgespeeld → "Listen again"); zonder geschiedenis gedimd en zonder actie.
- De kaart "10 free sessions" blijft altijd Free Sessions (voor niet-Premium).

## 6. Bewegingstaal (Apple-stijl: fysica, onderbreekbaar, UI-thread)
- **Veren, geen tijdcurves** voor beweging (schaal, positie, verschijnen). `withTiming` enkel voor opacity/kleur en voor
  bewegingen die aan een ritme gekoppeld zijn (ademfiguur, countdown): die houden hun exacte duur.
- Tokens (`motion.ts`): `SPRING_PRESS_IN` (strak), `SPRING_PRESS_OUT` (kleine nasprong), `SPRING_POP` (gekozen element popt),
  `SPRING_SETTLE`, `SPRING_SHEET`, `POPUP_IN` (popupkaart).
- Elke knop/kaart/rij gebruikt `Tap` (of `PressScale`/`CardBounce`): indrukken krimpt, loslaten veert terug. Nooit een kale `Pressable`
  voor een knop. Uitzonderingen: schermvullende achtergronden/dismiss-lagen en "vang tikken op"-wrappers.
- Gekozen toestand: ring en gloed zoomen met een veer in beeld, het pictogram popt; paginabolletjes groeien met een veer.
- Keuzepagina's laten hun onderdelen gespreid binnenkomen (veer, 40–70 ms stagger).
- Popups/alerts: de kaart komt met `POPUP_IN` in beeld (`PopupCard`/`PopupView`); achtergrond dooft zacht in.
- Sheets (`GlassSheetHost`): veer open (onderbreekbaar), snelle gedempte veer dicht, versleepbaar.
- Navigatie: Android `ios_from_right`; iOS terugvegen vanaf overal. Tabbalk-icoon: dunne lijn, bounce bij kiezen.
- Eindeloze animaties (Ken Burns, shimmer, ademende kaarten) lopen enkel zolang het tabblad zichtbaar is.
- Grote bewegende foto's/kaarten op Android als hardware-textuur (`renderToHardwareTextureAndroid`).
- Systeeminstelling "beweging verminderen"/"animaties verwijderen" wordt gerespecteerd (`isReduceMotion`).
- Meten i.p.v. gokken: `adb shell dumpsys gfxinfo <pakket>` (frames, haperingen, GPU-tijd) vóór/na elke wijziging.

## 7. Popups
- Alle popupkaarten in `VibezGlass`, dezelfde veer in beeld, knoppen via `Tap`, sluiten op dezelfde tik is veilig
  (animatie wordt bij verdwijnen gestopt).

## 8. Werkwijze
- Elke wijziging: tsc schoon, bouwen, op de A16 bekijken, pixel/gfxinfo meten waar het kan, pas dan melden. Wat niet gezien is, zeggen.

## Toevoeging 24 okt 2026 — cascade, tabwissel, paginabolletjes
- **Cascade ("vloeien")**: de grote blokken van elk scherm komen na elkaar in beeld met `reveal(i)` uit `src/constants/motion.ts` (FadeInDown (begint 25 dp onder zijn plek en veert omhoog), veer dempingsratio ≈ 0,85, staffel 70 ms, i = volgorde van boven naar onder, max. 8). Zelfde bewegingstaal als de Breath-picker. Niet op elk los element.
- **Tabwissel**: zachte crossfade (`animation: 'fade'` in `(tabs)/_layout.tsx`), geen harde wissel.
- **Paginabolletjes (State Control)**: niet-actief = grijs (wit 32%) en iets kleiner (schaal 0,7); actief = wit en groter (schaal 1). Overgang met `SPRING_SETTLE`.
