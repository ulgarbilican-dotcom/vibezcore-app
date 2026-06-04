# VIBEZCORE — User flows: Free & Bracelet PRO

> **Status:** vastgelegd 2026-06-04 (iter 9dq v99)
> **Scope:** alleen Free-omgeving + Bracelet PRO-omgeving.
> Audio PRO en Full PRO worden in een aparte spec gefinaliseerd.
> **Bron:** operator-bevestigde gedragstesten in dev-mode + production reality-check.

Dit document is de **single source of truth** voor hoe Free- en Bracelet-PRO-gebruikers de app ervaren. Wijzigingen aan deze flows vereisen expliciete operator-goedkeuring.

---

## 1. Free / Guest-omgeving

De default-staat van elke verse gebruiker. Geen account, geen entitlements. App blijft volledig bruikbaar — gast-first principe (CLAUDE.md §3).

### 1.1 Cold-start

| Conditie | Eerste scherm |
|---|---|
| Eerste app-open, geen token | **Welcome-screen** (welcome.tsx) — fullscreen bg + wordmark + 2 grote knoppen + "Already have a product? Sign in" link |
| Welcome al eens overgeslagen, nog steeds geen token | Audio Library (default tab) |

**Welcome-knoppen:**
- "Explore Bracelet" → `/bracelet` tab (etalage-modus)
- "Explore Audio Library (listen free sessions)" → `/` Audio-tab
- "Already have a product? Sign in" → `/account` tab (signed-out view)

### 1.2 Audio Library-tab — Free

- **Series-overzicht:** 14 series, elk met 5 sessies.
- **Free-toegang:** 1ste sessie per serie is gratis te beluisteren zonder account.
- **Locked-toegang:** sessies 2-5 → tap → "Sign up for access"-prompt → /account.
- **Soundscapes:** volledig vrij (geen lock).
- **Continue-card:** toont laatst-gespeelde free sessie indien aanwezig.
- **Pricing-block:** onderaan, scrollbaar via "Upgrade to full library"-CTA's. Toont €9.99/maand en €59.99/jaar (strike-prijzen €12.99/€9.99 als refrentie).
- **Tap pricing → /subscribe** (review-screen) → IAP-popup.

### 1.3 Bracelet-tab — Free

- **PreviewBanner** bovenaan: "PREVIEW · Bracelet ships Summer 2026"
- **Etalage-modus:** how-it-works carrousel, mode-carrousel (Boost/Sharp Focus/Calm Control/Clarity/Rest & Reset met foto's), editions, Kickstarter countdown.
- **Geen control-page** — visitor heeft geen bracelet.
- **Reserve-CTAs:**
  - "Reserve your spot — VIBEZCORE Smart Bead Bracelet" → vibezcore.com/subscribe-bracelet
  - "Reserve your spot — VIBEZCORE Full Bundle (Bracelet + 12-mo Audio)" → vibezcore.com/subscribe-bundle
- **Disclaimer:** "No credit card · No financial data · No purchase obligation"

### 1.4 Account-tab — Free / Signed-out

- **Hero block:** "WELCOME TO" eyebrow + VIBEZCORE wordmark + accent bar
- **SIGN IN card:** Email + Password + Show/Hide toggle + "Sign in" knop + "Forgot password?" link + "You'll stay signed in on this device"
- **"or get started" divider**
- **PRODUCT CARDS:**
  - Audio Library — "AVAILABLE NOW" + "Subscribe" → /
  - Smart Bead Bracelet — "EARLY BIRD · LAUNCHING 1 AUG" + 2 reservatie-opties
- **Legal footer:** Terms · Privacy · Access · Shipping · Refund · Cookies · Health · Audio

### 1.5 Activate-bracelet (Free user)

Een Free / Guest die op `/activate-bracelet` belandt (via deeplink of UI-pad) krijgt:

- 🔒 **"Sign in first"-scherm**
- Tekst: "Your bracelet is linked to your VIBEZCORE account. Please sign in or create an account before entering your activation code."
- Knop: "Go to sign in" → /account

### 1.6 Sign-up → wat verandert?

- **Tijdens sign-up:** verse user maakt account → Supabase auth via Netlify-proxy.
- **Na sign-up:** blijft op /account (geen redirect). User ziet signed-in view.
- **Subscription-card:** "Free account · Upgrade for full library access"
- **Geen BraceletCard** (geen bracelet entitlement).
- **Geen ActivateBraceletCta** (operator-besluit: alleen bracelet-owners zien deze).

### 1.7 Sign-out

- Confirmation-dialog: "Sign out?"
- Bij bevestigen:
  - Token wist
  - Dev-overrides + activation-flag wissen (alleen in dev)
  - history-bucket terug naar 'anon'
  - signed-URL cache + lastPlayed wissen
  - Email-veld pre-filled met laatst-gebruikte email

---

## 2. Bracelet PRO-omgeving

Verkregen door koop van een Smart Bead Bracelet → account-koppeling via activation-code. Heeft géén audio-PRO subscription (los daarvan).

**Dev-toegang:** Settings → Developer → Override = **Bracelet owner**.

### 2.1 Cold-start (returning Bracelet PRO)

| Conditie | Eerste scherm |
|---|---|
| Token aanwezig + backend zegt bracelet-PRO, OF dev-override = bracelet | **/bracelet tab direct** — geen welcome, geen audio |

Reden (CLAUDE.md §3, geconfirmeerd): Bracelet-PRO users hebben de bracelet als primaire interactie. Audio Library is een upsell-target, niet de landing.

### 2.2 Sign-up + activate flow (first time)

```
Welcome → "Sign in" → /account
   ↓ tap "Sign up"-toggle, vul email + password → submit
Signed-in view:
   - Subscription-card: "Bracelet PRO" (blauw)
   - BraceletCard: "Activation required" (amber)
       + "Your bracelet is not yet linked to this account..."
       + [Activate your bracelet →] CTA
   ↓ tap
/activate-bracelet:
   - 12-char code form (auto-format XXXX-XXXX-XXXX)
   - Submit → mock 600ms → success-screen → /bracelet-control
After activation:
   - BraceletCard: "Bracelet activated"
       + [Open Bracelet Control] + [Order new beadband]
   - Bracelet-tab: full control UI
```

### 2.3 Login flow (returning Bracelet PRO)

| Stap | Wat gebeurt |
|---|---|
| /account, signed-out view, sign in | Real Supabase auth |
| Na succes | **router.replace('/bracelet')** — direct naar Bracelet-tab |
| Daar | Activation-status bepaalt of CTA verschijnt of normale control UI |

Audio PRO en Free → `router.replace('/')` (Audio Library). Bracelet en Full PRO → `/bracelet`.

### 2.4 Account-tab — Bracelet PRO (signed-in)

**Subscription-card:**
- bigText: **"Bracelet PRO"** (blue) — entitlement-naam, niet activation-state
- subText: "Audio Library not yet activated"
- CTA: "Add Audio Library" → /  (Audio-tab pricing)

**My account:**
- Email (read-only)
- Password — "Change" → /change-password

**BraceletCard — pre-activation:**
- Label: "Bracelet"
- bigText: **"Activation required"** (amber #f59e0b)
- subText: "Your bracelet is not yet linked to this account. Enter your 12-character activation code to pair it."
- CTA: **"Activate your bracelet →"** → /activate-bracelet

**BraceletCard — post-activation:**
- bigText: "Bracelet activated" (blue)
- subText: "Open Bracelet to preview your modes and review your activation."
- CTA 1: "Open Bracelet Control →" → /bracelet
- CTA 2: "Order new beadband →" → vibezcore.com/shop/beadbands

**Settings & help:** Restore purchases · Settings · About VIBEZCORE · FAQ · Contact support

**Bottom:** Sign out + Danger Zone (Delete account) + Legal & Safety

### 2.5 Bracelet-tab — Bracelet PRO

Renders inline `<BraceletControl />` (geen redirect, blijft binnen tab-bar).

#### 2.5.1 Disconnected state — pre-activation

- PreviewBanner top
- **Geen** BraceletActivationCta (zou 3x dezelfde CTA op één scherm zijn)
- Geen radar-pulse animatie
- Titel: **"Bracelet not linked"**
- Sub: "Activate your bracelet with your 12-character code to connect it to this account."
- Bottom: primary blauwe **"Activate your bracelet"**-knop

#### 2.5.2 Disconnected state — post-activation

- PreviewBanner top
- Radar-pulse animatie
- Titel: "Looking for your bracelet" / "Searching" / "Connecting"
- Sub: "Make sure your bracelet is nearby and powered on."
- Bottom: **"Connect" / "Retry"** knop

#### 2.5.3 Idle state (connected) — pre-activation

- PreviewBanner top
- **BraceletActivationCta** banner (blauw accent): "Activate your bracelet →"
- Status-row: CONNECTED · Ready + battery %
- **Geen** Disconnect-link (toon alleen na activatie)
- Mode-picker carousel (5 modi met foto's)
- Duration slider
- Bottom: "Start"-knop (sim werkt, productie-bracelet zou nog niet bestaan)

#### 2.5.4 Idle state (connected) — post-activation

- PreviewBanner top
- Status-row: CONNECTED · Ready + battery %
- **"Disconnect bracelet"** link (klein, onderlijnd, rechts onder status-row)
- Mode-picker + duration + Start

#### 2.5.5 Active session

- Geen banner-clutter (immersive)
- Timer + mode + pause/resume/end + breathwork-toggle
- End → bracelet-history + redirect

### 2.6 Audio-tab — Bracelet PRO (no audio sub)

Niet de full audio library — **korte bracelet-only landing-page**. Reden: bracelet PRO user is hier secundair, niet primair.

**Landing-page (default state):**
- Hero met "Audio Library Add-on"
- Voordelen-lijst (waarom audio + bracelet)
- Pricing + CTA "Upgrade now"
- Knop "Explore free sessions →" (alleen om rond te kijken)

**Free-env modus (na tap "Explore free sessions"):**
- Volledige library zichtbaar (zelfde als Free-user-view)
- 14 series, 1st-of-series gratis
- Pricing-card onderaan

**State-transitions (geconfirmeerd 2026-06-04):**

| Actie | exploredLibrary | Schermresultaat |
|---|---|---|
| Cold-start | false | **Landing** |
| Tap "Explore free sessions" | true | Free-env |
| Play free sessie → player modal open | true | (geen reset) |
| Player modal close | true | **Blijft in free-env** ✓ |
| Tap Bracelet tab → tap Audio tab | **false** | **Terug naar landing** ✓ |
| Tap Account tab → tap Audio tab | false | Terug naar landing |
| Tap Audio tab terwijl er op staat | false (reset) | Terug naar landing |

**Implementatie:** signaal `requestLibraryReset()` vanuit `(tabs)/_layout.tsx` TabButton fire-and-forget bij Audio-tab-press; `(tabs)/index.tsx` subscribet en reset `exploredLibrary` naar `false`. Geen useFocusEffect (zou ook op modal-close firen).

### 2.7 Sign-out (Bracelet PRO)

Zelfde als Free-sign-out, plus:
- Dev-override teruggezet naar `null` (dev-only)
- Bracelet-activation flag teruggezet naar `false` (dev-only)
- → Eindigt in schone Free/Guest-staat

Reden: anders inconsistentie ("Account zegt uitgelogd maar Bracelet-tab toont nog PRO-omgeving").

---

## 3. Wat gemeenschappelijk is (Free + Bracelet PRO)

### 3.1 Bracelet-tab activation banner

- Verschijnt alleen op idle/charging/fault states wanneer `isBraceletOwner && !isActivated`.
- Verdwijnt na activation.
- Verdwijnt op disconnected-state (anders 3× zelfde CTA).
- Verdwijnt tijdens active session (immersive).

### 3.2 Disconnect / Reconnect (BLE-laag)

- Disconnect = puur BLE-handshake los; account-koppeling blijft staan.
- Reconnect via "Connect" knop in disconnected-state (post-activation).
- Werkt onafhankelijk van activation — eens geactiveerd, BLE-state is on/off.

### 3.3 Auth-guard /activate-bracelet

- Niet ingelogd + geen override die signed-in simuleert → "🔒 Sign in first"-scherm.
- Voorkomt 12-char-typ-frustratie in productie (backend zou 401 returnen).
- Dev-override 'audio'/'bracelet'/'pro' passeert (simulatie van signed-in).

---

## 4. Activatie ≠ BLE-connectie (begripsmodel)

Strikt onderscheid om verwarring te voorkomen:

| Concept | Scope | Hoe vaak | Persistentie |
|---|---|---|---|
| **Activatie** (code) | Account-level (backend) | **Eénmaal** per bracelet | Survives device-switch, OS-reinstall, logout-login |
| **BLE-connectie** | Device-level (lokaal) | Per sessie / on-demand | Reset bij OS, telefoon-wissel, manual disconnect |

### Scenario: nieuwe telefoon

1. Oude telefoon → activatie code XYZ ingevoerd → backend weet "user A → bracelet B"
2. Telefoon kapot / nieuwe gekocht
3. Nieuwe telefoon → app install → login zelfde account
4. Backend: "yes activated" → géén code-her-invoer nodig
5. BLE pair op nieuwe telefoon (eenmalig per device) → klaar

### Scenario: bracelet verkopen / weggeven

- Operator-keuze pending — zie OPERATOR_HANDOVER.md.
- Tot dan: handmatig via support (zelfde patroon als account-delete).

---

## 5. Implementatie-checklist (backend-dev)

Voor productie-realisatie moet backend leveren:

- [ ] Tabel `bracelet_activations(user_id, code, activated_at)` in Supabase
- [ ] `POST /api/bracelet/activate` met Bearer-auth, body `{code}`, returnt `{ok, activated_at, model?}`
- [ ] Error responses: `invalid_code` / `already_used` / `expired` / `code_not_found` / `unauthorized`
- [ ] `GET /api/subscription-status` uitbreiden met `has_bracelet_activated: boolean`
- [ ] App: `useSubscription` leest dat veld → `useBraceletActivated` (productie-versie) baseert op subscription-state ipv lokale dev-flag
- [ ] Deactivate-flow (operator-keuze): support-only OF `POST /api/bracelet/deactivate`

Zie ook: `src/services/bracelet-activation.ts` en `src/utils/dev-user-override.ts` voor inline backend-spec.

---

## 6. Wijzigingen-historiek (deze flows)

| Datum | Iter | Wijziging |
|---|---|---|
| 2026-05-19 | — | Gast-first principe vastgelegd (CLAUDE.md §3) |
| 2026-06-03 | 9dq v89 | Activate-flow eerste implementatie + entitlement-split |
| 2026-06-03 | 9dq v90→v91 | Entitlement-split teruggedraaid — payment = PRO env meteen |
| 2026-06-03 | 9dq v92 | Activation-banner op bracelet-control + activate CTA in account-card |
| 2026-06-03 | 9dq v93 | "Bracelet ready" → "Activation required" + disconnected-screen "Bracelet not linked" |
| 2026-06-03 | 9dq v94 | "Bracelet active" → "Bracelet PRO" (subscription-card) |
| 2026-06-03 | 9dq v95 | Disconnect-link in idle-screen |
| 2026-06-03 | 9dq v96 | Post-login routing per user-type (sign-up → /account, bracelet → /bracelet) |
| 2026-06-04 | 9dq v97 | Auth-guard op /activate-bracelet |
| 2026-06-04 | 9dq v98 | Library-reset-intent: tab-switch reset zonder modal-close conflict |
| 2026-06-04 | 9dq v99 | Sign-out wist dev-overrides + activation-flag |
| 2026-06-04 | — | **Deze flow-spec vastgelegd** |

---

**Einde document. Wijzigingen vereisen operator-goedkeuring + nieuwe iter-rij in §6.**
