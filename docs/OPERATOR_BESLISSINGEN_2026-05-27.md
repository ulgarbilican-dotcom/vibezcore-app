# Operator-beslissingen — pre-launch polish ronde

> Status: 27 mei 2026. Voortgekomen uit de 4-agent audit van de master polish-checklist. Alle items hieronder zijn **geblokkeerd op jouw input** — code-fixes liggen klaar maar wachten op een keuze.
>
> Volgorde: items waar copy/tekst beslist moet worden eerst, daarna backend-werk, daarna juridisch. Onderaan: nice-to-have-vragen waar geen rush op zit.
>
> **Hoe te gebruiken:** loop top-naar-beneden door, kies per item (a/b/c of typ alternatief). Ik verwerk in batch zodra je een blok bevestigt.

---

## 1. Welcome page copy — code wijkt af van CLAUDE.md §3

**Status:** CLAUDE.md §3 schrijft een **operator-vastgelegde** copy voor. De code in `src/app/welcome.tsx` toont iets anders. Eén van beide is achterhaald.

### 1a. Intro-tekst
| | Tekst |
|---|---|
| **CLAUDE.md §3** | "Stop being a passenger in your own life. Change the game. Unlock your full potential." |
| **Huidige code** | "Stop Drifting. Start Directing." + (eyebrow) "CHANGE THE GAME · UNLOCK YOUR FULL POTENTIAL" |

**Welk is de definitieve?** Kies:
- [ ] **a)** CLAUDE.md is de waarheid — wijzig code terug naar lange tekst
- [ ] **b)** Huidige code is de waarheid — update CLAUDE.md §3 om dat te reflecteren
- [ ] **c)** Geen van beide — nieuwe definitieve tekst: _______________

### 1b. Audio-knop label
| | Tekst |
|---|---|
| **CLAUDE.md §3** | "Explore Audio Library (listen free sessions)" |
| **Huidige code** | "Explore Audio Library" |

- [ ] **a)** Voeg "(listen free sessions)" toe — CLAUDE.md wint
- [ ] **b)** Laat code zoals 'ie is — kortere knop wint
- [ ] **c)** Andere copy: _______________

### 1c. Welcome-gedrag bij terugkomende bezoeker (nog open van eerder)
Operator-besluit van 27 mei was nog niet definitief. Jij neigde naar "elke keer tonen" (bracelet-exposure pre-Kickstarter).

- [ ] **a)** Élke cold-start tonen voor bezoekers zonder account (huidig gedrag, bracelet-exposure prio)
- [ ] **b)** Één keer tonen, daarna onthouden via `welcome_seen=true`
- [ ] **c)** Één keer + handmatige "Welcome" link in Account-tab

---

## 2. Audio Library copy — borderline self-help claim

In `src/app/(tabs)/index.tsx` staat als mission-sub-copy:

> **"The life you want requires a version of you that doesn't exist yet."**

**Audit-bezwaar:** mogelijk te dicht bij self-help-claim. CLAUDE.md §1 verbiedt medische/wetenschappelijke claims, dit valt niet daaronder, maar voelt psychologisch zwaar voor een audio-library landing.

- [ ] **a)** Houden — past bij de toon "stop drifting / change the game"
- [ ] **b)** Verzachten naar: _______________ (bv. "Become the version of you you've been waiting for")
- [ ] **c)** Vervangen door iets neutraals over audio-content

---

## 3. Bracelet-teaser animatie

In `src/app/(tabs)/index.tsx` regel 1709 staat letterlijk:

```
TODO: animatie nog te ontwerpen (operator stuurt specs)
```

Dit is de teaser-card die audio-users naar de Bracelet-tab moet trekken. Nu is 'ie statisch.

**Wat heb je nodig om dit te kunnen ontwerpen?** Suggesties:
- [ ] **a)** Sober: pulserende dot in mode-kleuren cyclus (bestaande primitief al gebouwd in bracelet-control)
- [ ] **b)** Lottie/GIF: stuur asset, ik bouw 'm in
- [ ] **c)** Video-loop: link naar mp4 op Bunny CDN
- [ ] **d)** Geen animatie nu — laat statisch tot post-Kickstarter

---

## 4. Account / Legal — onafgewerkte teksten

### 4a. `[OPERATOR]` placeholder in account.tsx
Bij `src/app/(tabs)/account.tsx` regel 829 staat in de signed-out view nog:

> "[OPERATOR] Terms / Privacy text from the web app to be placed here before launch."

Dit is wat bezoekers/sign-up-users zien onder het sign-in/sign-up-form. Moet definitieve copy in. Voorstel:

> By creating an account you agree to our [Terms of Service](/legal/terms) and [Privacy Policy](/legal/privacy). We don't share your data with third parties without consent.

- [ ] **a)** Bovenstaande copy gebruiken
- [ ] **b)** Andere copy: _______________
- [ ] **c)** Geen tekst, alleen twee links naar /legal/terms en /legal/privacy

### 4b. Hardcoded prijzen in legal/Terms
`src/data/legal-content.ts` regel 75 noemt letterlijk **$8.99/month** en **$79.99/year**. Pricing-drift risico — als je morgen $9.99 wil, moet 't ook hier.

- [ ] **a)** Houd hardcoded; ik beloof prijs nooit te wijzigen zonder dit doc te updaten
- [ ] **b)** Vervang door generieke verwijzing "current pricing shown at checkout" + link
- [ ] **c)** Inject prijs vanuit één centrale config (ik maak `src/constants/pricing.ts`)

### 4c. Belgian governing law
Alle 5 legal-docs verwijzen naar **Belgian law** + **Belgian DPA**. Audit-vraag:

- [ ] **a)** Bevestigd — VIBEZCORE legal entity is BE-geregistreerd
- [ ] **b)** Niet BE → ander land: _______________
- [ ] **c)** Nog onbekend — laat tijdelijk staan, gevlagd voor pre-launch update

### 4d. Health & Safety crisis-resources
Het Health-doc verwijst alleen naar **findahelpline.com**. Audit suggereert ook **US 988** en **EU 116 123** inline voor betere reviewer-ervaring (Apple/Google app reviews zoeken hiernaar bij mental-health-apps).

- [ ] **a)** 988 + 116 123 toevoegen
- [ ] **b)** Alleen findahelpline.com (huidige)
- [ ] **c)** Andere lijst:  _______________

---

## 5. Backend-werk (niet door mij, voor je dev/jou)

### 5a. Bracelet-owner endpoint
In `src/app/(tabs)/bracelet.tsx` L834 staat:

```typescript
const isBraceletOwner = false; // placeholder until backend endpoint
```

Hierdoor wordt de owner-CTA nooit gerenderd. **Nodig:** backend-endpoint `/api/me/bracelet-status` of include `bracelet_owner` in de bestaande `/api/me/subscription` response.

- [ ] **a)** Voeg `bracelet_owner: boolean` toe aan bestaande subscription-endpoint response
- [ ] **b)** Nieuwe dedicated endpoint
- [ ] **c)** Skip tot na Kickstarter-fulfillment (geen ownerschap mogelijk tot bracelet uitgeleverd)

### 5b. Gumroad `manage_url` server-side
`src/services/subscription-actions.ts` bouwt nu Gumroad's "Manage subscription"-URL **client-side**. Dit schendt CLAUDE.md §1 (provider-agnostic principe — app mag alleen praten met `app.vibezcore.com/api/*`, geen provider-knowledge).

**Nodig:** backend `/api/me/subscription` response moet `manage_url: string | null` includeren (zelf bepalen welke provider).

- [ ] **a)** Backend voegt `manage_url` toe — ik strip de client-side URL-builder
- [ ] **b)** Laat zoals 'ie is (we breken CLAUDE.md-principe bewust voor pre-launch snelheid)
- [ ] **c)** Volledig weghalen — user gaat naar `info@vibezcore.com` voor cancel

### 5c. Gumroad-webhook recover→invite (van vorige sessie)
We hadden eerder afgesproken dat de webhook `gumroad-webhook.js` aangepast moest worden: nieuwe Gumroad-kopers krijgen nu via `/auth/v1/recover` een mail met "reset password" copy — terwijl 't eigenlijk een eerste-keer-setup is.

**Status:** webhook-patch nog niet gedeployed. Supabase email templates ook niet geconfigureerd (Invite + Recovery templates moeten naar `vibezcoreapp://reset-password?token_hash={{ .TokenHash }}` redirecten).

- [ ] **a)** Plan ik in komende dagen, geef ik door als klaar
- [ ] **b)** Doe vandaag/nu
- [ ] **c)** Skip tot Kickstarter klaar is (alleen audio-flow nu)

---

## 6. Bracelet — copy & branding (CLAUDE.md §5 markeert deze als `[OPERATOR]` niet-final)

CLAUDE.md §5 zegt expliciet dat de 5 mode-namen **voorlopig** zijn. Status check:

| # | Huidige naam (code) | Mode-tech | Status |
|---|---|---|---|
| 0 | **Boost** | Gamma | Final? [ ]Ja [ ]Nee: _______ |
| 1 | **Sharp Focus** | Beta | Final? [ ]Ja [ ]Nee: _______ |
| 2 | **Calm Control** | Alpha | Final? [ ]Ja [ ]Nee: _______ |
| 3 | **Clarity** | Theta | Final? [ ]Ja [ ]Nee: _______ |
| 4 | **Rest & Reset** | Delta | Final? [ ]Ja [ ]Nee: _______ |

### 6a. Bracelet etalage hero-tekst — voelt 'ie definitief?

Huidige hero (mockup-faithful):
> "**VIBEZCORE** Smart Bead Bracelet"
> + subtitle: (operator nog te bevestigen of dit definitief is)

- [ ] **a)** Definitief
- [ ] **b)** Nog te wijzigen — alternatieve copy: _______

### 6b. Kickstarter-prijzen (laatste check vóór launch)

Huidig in `(tabs)/bracelet.tsx`:
- Full Bundle: **$219** (was $483, save $264)
- Bracelet Only: **$129** (was $199, save $70)
- Extra Bracelet add-on: **$49**

- [ ] **a)** Final
- [ ] **b)** Aanpassen: _______________

### 6c. Mockup vs werkelijkheid — bracelet-render
Huidige render-PNG is operator-aangeleverd. Verwacht je vóór Kickstarter een definitieve foto van het echte product (na firmware-validatie nRF52832 + DRV2605L)?

- [ ] **a)** Render blijft tot launch
- [ ] **b)** Vervang door foto wanneer beschikbaar, ik stuur asset
- [ ] **c)** Operator twijfelt nog

---

## 7. Nice-to-have (geen rush)

### 7a. Audio quality toggle in Settings
In `src/app/settings.tsx` staat een toggle "Audio quality" die niets doet (placeholder). Twee opties:

- [ ] **a)** Verwijder tot 't echt werkt
- [ ] **b)** Disabled + "Coming soon"-badge
- [ ] **c)** Implementeer: stuur me het backend-flag-name (`audio_quality_high: boolean` per user-record?)

### 7b. Apple SSO "SOON" badge
Account-form heeft een disabled Apple-SSO-knop met "SOON". Pre-launch clutter of legitieme teaser?

- [ ] **a)** Helemaal weghalen tot 't live is
- [ ] **b)** Houd zoals 'ie is
- [ ] **c)** Verplaats naar onderkant van het form

### 7c. Restore Purchase (iOS-reviewer-vereiste)
Apple review-team verwacht een "Restore Purchase"-knop op iOS, ook als je via Gumroad betaalt (gebruiken ze om te checken of je niet stiekem App Store-betalingen omzeilt).

- [ ] **a)** Voeg toe — knop die `/api/me/subscription` opnieuw fetcht + status refresh
- [ ] **b)** Skip — Gumroad is duidelijk geen IAP, review-risico klein
- [ ] **c)** Onderzoek nodig

### 7d. Export my data (GDPR Art. 20)
Privacy Policy belooft data-portability maar er is geen UI-pad. Settings → "Export my data" knop die backend-endpoint aanroept en JSON downloadt.

- [ ] **a)** Voeg toe — backend `/api/me/export` endpoint nodig (geeft user's history + entitlements terug)
- [ ] **b)** Skip — verwijs naar info@vibezcore.com in privacy policy
- [ ] **c)** Plan voor post-Kickstarter

---

## Werkwijze

Geef per blok (1, 2, 3, ...) terug welke optie je kiest. Ik verwerk in een aparte commit per logisch blok. Items waar nog backend-werk voor moet, vlag ik als "wacht op backend" zodat we de timeline kennen.

Items die je doorstreept blijven open — ik zeur niet, jij komt er op terug.

---

_Gegenereerd 27 mei 2026 vanuit de master polish-checklist. Updates op deze beslissingen → terug in deze file (zelfde structuur), met datum-versie._
