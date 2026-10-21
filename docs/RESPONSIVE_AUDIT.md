# Responsive audit (21 okt 2026)

Regel: elk scherm is pas ✅ na een screenshot op het toestel/de emulator.
Formaten: **S** 360×640 · **M** 411×890 · **L** 430×932. Overige controles per scherm:
geen overlap, geen afgesneden tekst/knoppen, safe-area, tikdoel ≥ 44 dp, grotere systeemletter.

| Scherm | S | M | L | Opmerkingen |
|---|---|---|---|---|
| about | ☐ | ☐ | ☐ | |
| activate-bracelet | ☐ | ☐ | ☐ | |
| agenda | ☐ | ☐ | ☐ | |
| auth-callback | ☐ | ☐ | ☐ | |
| bracelet-agenda | ☐ | ☐ | ☐ | |
| bracelet-control | ☐ | ☐ | ☐ | |
| bracelet-history | ☐ | ☐ | ☐ | |
| bracelet-protocol | ☐ | ☐ | ☐ | |
| bracelet-set-day | ☐ | ☐ | ☐ | |
| breath-history | ☐ | ☐ | ☐ | |
| breath-pacer-preview | ☐ | ☐ | ☐ | |
| breath-quiz | ☐ | ☐ | ☐ | |
| breath-sample | ☐ | ☐ | ☐ | |
| breath-session | ✅ | ✅ | ☐ | beeld schaalt; boog-gloed niet meer afgesneden |
| breath-setup | ✅ | ☐ | ☐ | scrolt onder 760 dp; tekst niet meer achter knop |
| breath-splat | ☐ | ☐ | ☐ | |
| breath-welcome | ☐ | ☐ | ☐ | |
| build-choice | ⚠ | ☐ | ☐ | scrolt; CTA pas na scrollen zichtbaar op S |
| build-your-day | ☐ | ☐ | ☐ | |
| change-password | ☐ | ☐ | ☐ | |
| faq | ☐ | ☐ | ☐ | |
| feel-now | ⚠ gefixt (afgekapte techniek-naam), hercontrole | ☐ | ☐ | |
| forgot-password | ☐ | ☐ | ☐ | |
| goal | ☐ | ☐ | ☐ | |
| heart-rate | ☐ | ☐ | ☐ | |
| history | ☐ | ☐ | ☐ | |
| intensity | ☐ | ☐ | ☐ | |
| plan-review | ✅ | ☐ | ☐ | iconen niet meer uitgerekt; naam wraapt |
| plan-success | ✅ | ☐ | ☐ | één vinkje |
| plan-summary | ☐ | ☐ | ☐ | |
| plan | ☐ | ☐ | ☐ | |
| player | ☐ | ☐ | ☐ | |
| reset-password | ☐ | ☐ | ☐ | |
| routine-intro | ☐ (fix, hertest) | ☐ | ☐ | ruimte voor CTA gereserveerd |
| settings | ☐ | ☐ | ☐ | |
| state-onboarding | ☐ | ☐ | ☐ | |
| subscribe | ☐ | ☐ | ☐ | |
| support | ☐ | ☐ | ☐ | |
| welcome | ✅ | ☐ | ☐ |  |
| (tabs)/account | ☐ | ☐ | ☐ | |
| (tabs)/activity | ☐ | ☐ | ☐ | |
| (tabs)/bracelet | ✅ | ☐ | ☐ | State Control-intro + dial schaalt; tabnaam past (fix, nog zien) |
| (tabs)/breath | ✅ | ✅ | ✅ | intro + vijf toestanden; Boost/Clarity links, Calm groter (M gezien) |
| (tabs)/index | ☐ | ✅ (intro + bracelet-kaart) | ☐ | Library-intro uitgezoomd; bracelet-kaart vaste hoogte |

## Officiële eisen (nog na te lopen)
- Google Play: edge-to-edge (Android 15), doel-SDK, grote schermen/tablets, 16 KB pagina's
- Apple HIG: safe areas, tikdoel 44 pt, Dynamic Type
- Systeem-lettergrootte 200% zonder afgesneden tekst

## Reeds gefixt vandaag
- Breath intro + toestanden (foto-offsets als verhouding; foto begrensd boven tekst)
- Setup-scherm scrolt op korte schermen; sessiebeeld krimpt; protocol-bouwer stap 3 badges schalen
- Dubbel vinkje na protocol-bevestiging weg
