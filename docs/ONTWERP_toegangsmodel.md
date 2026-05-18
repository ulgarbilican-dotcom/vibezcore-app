# VIBEZCORE — Ontwerpdocument: Toegangsmodel, Bracelet-activatie & Betaalprovider-abstractie

> Status: ONTWERP — beslissingen vastleggen vóór de bracelet-fase.
> Dit document raakt de backend (Supabase + webhook), niet de huidige audio-app-stap.
> De native app en de webapp-frontend worden provider-agnostisch gebouwd: zij praten
> alleen met de eigen backend, nooit rechtstreeks met Gumroad of Stripe.

---

## 1. Uitgangspunt — wat bestaat vandaag (feitelijk)

Geverifieerd in de projectbestanden:

- `auth.users` — Supabase Auth (login/signup, e-mail + wachtwoord).
- `public.users` — eigen tabel, surrogate `id`, gekoppeld via `auth_user_id` (UNIQUE, FK → auth.users).
- `public.subscriptions` — `user_id` (→ public.users.id), `tier` ('monthly' | 'yearly'), `status`, `valid_until`, `will_renew`, plus Gumroad-specifieke velden: `gumroad_subscriber_id`, `gumroad_product_id`, `gumroad_sale_id` (UNIQUE).
- `subscription-status` endpoint retourneert vandaag: `{ active, tier, status, email }`.

**Conclusie:** de backend kent vandaag alleen "actief audio-abonnement: ja/nee" en "maandelijks/jaarlijks". Er is geen begrip van bracelet-rechten, geen onderscheid tussen de drie gebruikerstypes, en de subscriptions-tabel is volledig Gumroad-gekleurd.

---

## 2. De drie gebruikerstypes (productbeslissing — operator)

| Type | Account vereist | Audio-toegang | Bracelet-bediening | Verkrijgt toegang via |
|------|-----------------|---------------|--------------------|-----------------------|
| **Gast (geen account)** | Nee | Alleen gratis sessies | Nee | n.v.t. |
| **Audio-only** | Ja | Volledige library (zolang abonnement actief) | Nee | Betaling (Gumroad/Stripe) |
| **Bracelet-only** | Ja | Alleen gratis sessies | Ja | Activatiecode |
| **Bracelet + Audio** | Ja | Volledige library, **1 jaar** | Ja | Activatiecode + audio-recht |

Kernprincipe: **iedereen mag vrij door de app**, alle sessies zien en de gratis sessies beluisteren — ook zonder account. Een account is pas nodig voor: volledige audio-library óf bracelet-bediening.

---

## 3. Het entitlements-model (architectuurvoorstel)

In plaats van "tier" als enige dimensie introduceren we **entitlements** (rechten) als losse, combineerbare permissies. Dit ontkoppelt audio-rechten van bracelet-rechten en maakt de drie types een natuurlijk gevolg in plaats van harde categorieën.

Voorgesteld: een nieuwe tabel `public.entitlements` (naast, niet in plaats van, subscriptions):

```
public.entitlements
  id              (pk)
  user_id         (fk → public.users.id)
  kind            'audio'  | 'bracelet'
  source          'gumroad' | 'stripe' | 'activation_code' | 'manual'
  valid_until     timestamp | null   (null = geen einddatum, bv. levenslang bracelet-recht)
  active          boolean
  created_at
  meta            jsonb              (provider-specifieke details, NIET in de app gebruikt)
```

De drie types ontstaan dan uit combinaties:
- Audio-only = entitlement `kind='audio'` actief.
- Bracelet-only = entitlement `kind='bracelet'` actief.
- Bracelet + Audio = beide entitlements actief (de audio-entitlement met `valid_until` = +1 jaar).

**Voordeel:** de native app vraagt straks alleen aan de backend "welke entitlements heeft deze gebruiker", en toont op basis daarvan audio en/of bracelet. Geen provider-logica in de app.

> Beslissing operator vereist: akkoord op een entitlements-tabel naast de bestaande
> subscriptions-tabel? (subscriptions blijft bestaan voor de Gumroad-betaalstroom;
> entitlements wordt de bron-van-waarheid voor toegang.)

---

## 4. Bracelet-activatie via codes

### 4.1 Twee niveaus van "uniek" (beide nodig, verschillende doelen)

**Niveau A — Hardware-identiteit (firmware/BLE-spoor):**
De nRF52832 heeft een fabrieksuniek Bluetooth device-adres. Daarnaast kan in de firmware een serienummer per bracelet worden gezet bij het flashen. Dit dient puur de technische BLE-verbinding (welk fysiek apparaat praat met de app). Niet voor rechten/verdienmodel.

**Niveau B — Activatiecode (verdienmodel/toegang):**
Een aparte, door ons gegenereerde code (op verpakking of via Kickstarter-fulfilment) die de gebruiker in de app invoert om bracelet-rechten aan zijn account te koppelen. Dit lost het "bracelet-only gebruiker"-probleem op zonder Gumroad/Stripe en zonder audio-abonnement.

### 4.2 Voorgestelde tabel `public.activation_codes`

```
public.activation_codes
  code            (pk, bv. 'VBZ-XXXX-XXXX-XXXX')
  batch           text          (welke productie/Kickstarter-batch)
  grants_audio    boolean       (true = code geeft ook 1 jaar audio = "bracelet+audio")
  audio_days      integer | null (bv. 365 voor het 1-jaar-recht)
  redeemed_by     uuid | null   (fk → public.users.id, null = nog niet ingewisseld)
  redeemed_at     timestamp | null
  created_at
```

Activatieflow:
1. Gebruiker maakt gratis account (e-mail + wachtwoord) in de app.
2. Gebruiker voert activatiecode in.
3. Backend valideert: code bestaat, nog niet `redeemed_by`.
4. Backend zet `redeemed_by`, maakt entitlement `kind='bracelet'` aan (en `kind='audio'` met +`audio_days` als `grants_audio=true`).
5. App ververst entitlements → bracelet-bediening + (eventueel) volledige audio ontgrendeld.

> Beslissingen operator vereist:
> - Codeformaat & lengte (voorstel: `VBZ-XXXX-XXXX-XXXX`, hoofdletters+cijfers, geen 0/O/1/I).
> - Hoe worden codes bij de bracelet geleverd? (in verpakking / per e-mail bij Kickstarter-fulfilment / beide)
> - Geeft de bracelet-aankoop standaard ook 1 jaar audio? (bepaalt `grants_audio` default per batch)
> - 1 code per bracelet, of herbruikbaar binnen 1 account? (voorstel: 1 code = 1 inwisseling, vast aan 1 account)

---

## 5. Betaalprovider-abstractie (Gumroad → eventueel Stripe)

### 5.1 Het probleem
De huidige `subscriptions`-tabel en webhook zijn Gumroad-specifiek (`gumroad_sale_id` etc.). Als de app rechtstreeks Gumroad-dingen zou kennen, zou een Stripe-overstap betekenen dat web én native herschreven moeten worden.

### 5.2 De oplossing — strikte scheiding
- **De app (native + web-frontend) praat NOOIT met Gumroad of Stripe.** Alleen met de eigen backend: `GET /api/subscription-status` (of een toekomstig `/api/entitlements`). Antwoord is provider-neutraal.
- **Alleen de backend weet** of een recht van Gumroad, Stripe, of een activatiecode komt. Provider-details blijven in `subscriptions.meta` / `entitlements.meta`, nooit in het app-antwoord.

### 5.3 Wat een Stripe-overstap later betekent
- **Hoeft NIET aangeraakt:** native app, webapp-frontend (mits de abstractie nu gerespecteerd wordt — dat doen we).
- **Moet WEL aangepast (backend, apart spoor):** een nieuwe Stripe-webhook die `entitlements` vult i.p.v. de Gumroad-webhook; migratie van bestaande actieve abonnees; uitfaseren van de Gumroad-webhook.
- Dit is een backend/business-klus die op elk moment kan, zonder de apps te raken, zolang de app provider-agnostisch blijft.

> Operator-beslissing (zakelijk, valt buiten dit technisch ontwerp): Gumroad vs Stripe
> hangt af van fees, uitbetaling, btw-afhandeling, abonnementsbeheer, land/volume.
> Dit document neemt geen standpunt in over welke provider beter is; het zorgt alleen
> dat de keuze later goedkoop te maken blijft.

---

## 6. Impact op de native app (huidige fase)

**Vrijwel geen.** Voor sign-in/signup en het audio-spoor verandert niets:
- Login/signup werkt identiek voor alle types (iedereen begint als gratis account).
- "Heeft deze gebruiker volledige audio" werkt al via de bestaande `subscription-status`.
- De app wordt nu al provider-agnostisch gebouwd (alles via `https://app.vibezcore.com/api/...`).

De entitlements/activatiecode-logica raakt vooral **Spoor 2 (bracelet)** en het "1 jaar audio"-recht. Die bouwen we wanneer de bracelet-fase begint; dit document is dan de blauwdruk.

---

## 7. Openstaande operator-beslissingen (samengevat)

1. Akkoord op `entitlements`-tabel naast `subscriptions`? (sectie 3)
2. Codeformaat activatiecodes? (sectie 4.2)
3. Levering van codes: verpakking / Kickstarter-mail / beide? (sectie 4.2)
4. Geeft bracelet-aankoop standaard +1 jaar audio? (sectie 4.2)
5. 1 code = 1 inwisseling, vast aan 1 account? (sectie 4.2)
6. Timing Stripe-overweging — nu beslissen of parkeren? (sectie 5; zakelijk, geen technische blokkade)

> Geen van deze blokkeert het audio-spoor. Ze moeten beantwoord zijn vóór de
> bracelet-fase (Spoor 2) begint.

---

## 8. Volgorde-advies (consistent met "audio eerst")

1. Sign-in/signup afbouwen — provider-agnostisch (loopt nu).
2. Audio-app afmaken + lanceren — geen entitlements-uitbreiding nodig (bestaande backend volstaat).
3. Vóór bracelet-fase: operator beantwoordt sectie 7, backend krijgt `entitlements` + `activation_codes` tabellen + endpoints.
4. Bracelet-fase: firmware + BLE + activatiescherm in de app, lezend uit entitlements.
5. Stripe-migratie: optioneel, apart backend-spoor, op elk moment zonder de apps te raken.
