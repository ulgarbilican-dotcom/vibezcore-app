# VIBEZCORE — Backend IAP Spec

**Status:** READY TO IMPLEMENT — frontend is wachten op deze endpoints om de IAP-launch te kunnen finaliseren.
**Datum:** 2026-06-17
**Context:** Audio Library = IAP-only (Apple StoreKit + Google Play Billing). Gumroad volledig verwijderd uit native app (iter 9dq v150).

---

## 1. POST `/api/iap-verify` — NIEUW

Receipt-verificatie bij Apple/Google + entitlement-update in Supabase. Frontend roept dit aan vanuit `src/app/subscribe.tsx:200-217` en `src/services/restore-purchases.ts:50-63` na een succesvolle StoreKit / Play Billing transactie.

### Request

```http
POST /api/iap-verify
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "platform":      "apple" | "google",
  "tier":          "monthly" | "yearly",
  "productId":     "com.ubili.vibezcoreapp.audio.monthly" | "com.ubili.vibezcoreapp.audio.yearly",
  "transactionId": "<storekit-transactionId | google-orderId>",
  "receipt":       "<apple-receipt-base64 | google-purchaseToken>"
}
```

### Server-side flow

1. **Verify JWT** — `supabase.auth.getUser(token)` → `userId` of `401`.
2. **Verify receipt** bij stores:
   - **Apple** (production-eerst, fallback naar sandbox bij `21007`):
     ```
     POST https://buy.itunes.apple.com/verifyReceipt
     { "receipt-data": <receipt>, "password": <APPLE_SHARED_SECRET>, "exclude-old-transactions": true }
     ```
     Check `status === 0`, `bundle_id === "com.ubili.vibezcoreapp"`, `latest_receipt_info[*].product_id === productId`, `expires_date_ms > now`.
   - **Google** Play Developer API (`androidpublisher.purchases.subscriptions.get`):
     ```
     GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.ubili.vibezcoreapp/purchases/subscriptions/{productId}/tokens/{purchaseToken}
     Authorization: Bearer <google-service-account-token>
     ```
     Check `paymentState === 1` (received) of `paymentState === 2` (free trial), `expiryTimeMillis > now`.
3. **Bij verify-failure** → `400 { error: "invalid_receipt" }` of `409 { error: "receipt_already_consumed" }`.
4. **Upsert Supabase `subscriptions`-rij** met:
   ```
   user_id, platform, product_id, transaction_id, original_transaction_id,
   tier, valid_until (ISO), will_renew (bool), receipt_data (encrypted),
   created_at, updated_at
   ```
5. **Return `200`**:
   ```json
   {
     "ok": true,
     "active": true,
     "tier": "monthly" | "yearly",
     "valid_until": "2027-06-17T00:00:00.000Z",
     "will_renew": true,
     "platform": "apple" | "google"
   }
   ```

### Errors

- `401` — missing/invalid JWT
- `400 invalid_receipt` — store-verify gefaald (verkeerde bundle, expired, tampered)
- `409 receipt_already_consumed` — die transactionId is al gekoppeld aan een ANDERE user (mogelijke fraude — log)
- `502 store_unreachable` — Apple/Google verify-call faalt → frontend retry-met-backoff

### Security

- `APPLE_SHARED_SECRET` + Google service-account-JSON in env-vars, niet in repo
- Encrypt `receipt_data` at rest (Supabase `pgsodium` of equivalent)
- Rate-limit per user: max 10 calls / minuut (anti-replay)

---

## 2. POST `/api/iap-webhook` — NIEUW (renewal / cancellation events)

Apple App Store Server Notifications V2 + Google Real-time Developer Notifications (RTDN) via Pub/Sub. **Geen JWT** — store-signature verifiëren.

### Apple `notificationType` mapping
- `DID_RENEW` → update `valid_until` + `will_renew=true`
- `DID_FAIL_TO_RENEW` → `will_renew=false` (grace period)
- `EXPIRED` → set `active=false`
- `DID_CHANGE_RENEWAL_STATUS` → update `will_renew` per `subscriptionGroupIdentifier`
- `REFUND` / `REVOKE` → set `active=false` + `revoked_at`

### Google `notificationType`
- `1 SUBSCRIPTION_RECOVERED`, `2 RENEWED`, `4 PURCHASED` → re-verify + update
- `3 CANCELED`, `12 REVOKED`, `13 EXPIRED` → mark inactive

### Verify signatures
- Apple: JWS-signed payload — verify met Apple public key
- Google: Pub/Sub-message verify met Google JWT-public-key set

---

## 3. UPDATE `/api/subscription-status` — bestaande endpoint

Voeg IAP-velden toe. Voorheen retourneerde 'ie `gumroad_subscriber_id` — die mag eruit (geen Gumroad-subscribers meer per operator-besluit 2026-06-12).

### Request (ongewijzigd)
```http
GET /api/subscription-status
Authorization: Bearer <supabase-jwt>
```

### Response (gewijzigd)
```json
{
  "active":       true,
  "tier":         "monthly" | "yearly" | null,
  "status":       "active" | "in_grace" | "cancelled" | "expired",
  "email":        "user@example.com",
  "valid_until":  "2027-06-17T00:00:00.000Z",
  "will_renew":   true,
  "platform":     "apple" | "google" | null
}
```

### Verwijderde velden
- ❌ `gumroad_subscriber_id` — frontend leest dit niet meer (verwijderd in [`useSubscription.ts:32-46`](../src/hooks/useSubscription.ts))

### Toegevoegde velden
- ✅ `platform` — `"apple" | "google" | null` (frontend gebruikt dit nog niet actief, maar handig voor backend-debug / support-tooling)

---

## 4. DEPRECATED — `/api/cancel-subscription`

Mag verwijderd worden. Frontend roept 'm niet meer aan ([`subscription-actions.ts`](../src/services/subscription-actions.ts) v150). Apple/Google policy verbiedt in-app subscription-cancellation voor IAP-content — user gaat naar Settings → Subscriptions via deeplink (`itms-apps://apps.apple.com/account/subscriptions` of `https://play.google.com/store/account/subscriptions`).

Indien backend nog legacy Gumroad-data heeft: archive-route (read-only) prima, maar geen nieuwe cancel-calls vanuit de app.

---

## 5. Test-checklist (sandbox)

### Apple Sandbox
1. App Store Connect → Users and Access → Sandbox → Tester aanmaken (apart icloud-account)
2. Op test-device: Settings → App Store → Sandbox-account inloggen
3. TestFlight-build van de app draaien → subscribe-flow doorlopen → check Supabase row
4. Wachten op renewal (sandbox = 1 maand in 5 min) → check webhook DID_RENEW
5. Cancel via Settings → Subscriptions → check webhook DID_CHANGE_RENEWAL_STATUS

### Google Sandbox
1. Play Console → License Testing → tester-emails toevoegen
2. Internal Testing track → app uploaden → opt-in-link delen met tester
3. Subscribe-flow doorlopen → check Supabase row
4. Real-time Developer Notification (RTDN) Pub/Sub-topic moet `iap-webhook` triggeren
5. Cancel via Play Store-app → check webhook SUBSCRIPTION_CANCELED

---

## 6. Frontend integratie-points

Plek waar de frontend de nieuwe endpoints aanroept:

| Endpoint | Frontend-file:regel | Wanneer |
|---|---|---|
| POST /api/iap-verify | `src/app/subscribe.tsx:200-217` | Na succesvolle StoreKit/Play-purchase |
| POST /api/iap-verify | `src/services/restore-purchases.ts:50-63` | Per gerestoreerde transaction |
| GET /api/subscription-status | `src/hooks/useSubscription.ts:160-181` | App-start + `refresh()` calls |
| (webhook) | n.v.t. — backend → backend | Async renewal/cancel events |

Frontend doet GEEN store-side verify zelf — dat is per definitie spoofable. Alleen backend kan dat veilig met de shared secret.

---

## 7. Product-IDs (in Apple/Google console aanmaken)

| Product | iOS ID | Android ID | Price (EUR) | Period |
|---|---|---|---|---|
| Monthly | `com.ubili.vibezcoreapp.audio.monthly` | `com.ubili.vibezcoreapp.audio.monthly` | €9,99 | 1 maand |
| Yearly  | `com.ubili.vibezcoreapp.audio.yearly`  | `com.ubili.vibezcoreapp.audio.yearly`  | €69,60 | 1 jaar |

- **Subscription group** (iOS): `vibezcore_audio_library`
- **Base plan** (Android): `monthly` / `yearly` met auto-renew
- **Localized prices**: laat App Store / Play converteren (USD ~$11.99/m, GBP ~£8.99/m)
- **Free trial / intro offer**: nog niet — operator-beslissing voor later

---

## Open items voor operator

- [ ] APPLE_SHARED_SECRET ophalen uit App Store Connect → Apps → VIBEZCORE → App Information → "App-Specific Shared Secret"
- [ ] Google service-account aanmaken met Play Developer API toegang → JSON-key in backend env
- [ ] Pub/Sub-topic instellen voor RTDN + subscription naar `/api/iap-webhook`
- [ ] App Store Server Notifications V2 endpoint URL invullen in App Store Connect
- [ ] Supabase `subscriptions`-tabel migratie schrijven (kolommen toevoegen)
