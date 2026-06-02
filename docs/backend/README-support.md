# Support form → Zoho SMTP — backend deployment

> **Status**: app-code klaar (iter 9dp, 2026-06-02). Backend wacht op deploy.
> Zodra deze 4 stappen klaar zijn, kan een user in de app op Send klikken
> en arriveert het bericht direct in info@vibezcore.com (Zoho inbox).

## Wat dit oplost

Voorheen opende de Send-knop een externe mail-app/Gmail web — user moest
**een tweede keer** Send klikken in een ander programma. Met deze backend:

- ✅ Één klik in de app → bericht verstuurd
- ✅ Werkt ook zonder native email-app op het toestel
- ✅ Reply-To gezet op user's email → in Zoho gewoon Reply drukken
- ✅ Category-prefix in subject voor inbox-triage
- ✅ HTML + plain-text versie voor beste rendering in elke mail-client
- ✅ Graceful fallback naar mailto bij netwerk/server-fail (user loopt nooit vast)

## Step 1 — Netlify env vars

Open Netlify → vibezcore-backend → **Site settings** → **Environment variables**.
Voeg toe:

| Key | Value |
|---|---|
| `ZOHO_EMAIL` | `info@vibezcore.com` |
| `ZOHO_APP_PASSWORD` | het 16-karakter app-password uit Zoho (NIET je login-pw) |
| `ZOHO_SMTP_HOST` | `smtp.zoho.eu` (EU regio — `.com` voor US, `.in` voor India) |
| `SUPPORT_INBOX` | `info@vibezcore.com` (optional, default = ZOHO_EMAIL) |

## Step 2 — `package.json` dependency

In de backend repo, voeg `nodemailer` toe aan dependencies:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "nodemailer": "^6.9.16"
  }
}
```

## Step 3 — Netlify function deploy

Kopieer `api-support.js` naar `netlify/functions/support.js` in de backend repo.

Voeg in `netlify.toml` een redirect toe:

```toml
[[redirects]]
  from = "/api/support"
  to   = "/.netlify/functions/support"
  status = 200
  force  = true
```

Deploy (`git push` naar main) — Netlify installeert nodemailer automatisch.

## Step 4 — Test

```bash
curl -X POST https://app.vibezcore.com/api/support \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Audio Library",
    "subject": "Test message",
    "message": "Hello from curl",
    "fromEmail": "test@example.com",
    "platform": "test"
  }'
```

Verwachte response:
```json
{ "ok": true }
```

En in je Zoho inbox arriveert een email:
- **From**: VIBEZCORE Support `<info@vibezcore.com>`
- **Reply-To**: test@example.com
- **Subject**: `[Audio Library] Test message`
- **Body**: HTML + plain-text met alle metadata

## Wat de native app doet

`src/app/support.tsx` orchestreert:

1. User kiest category, vult subject + message + email in
2. Klikt Send → POST naar `/api/support`
3. Bij 200 → "Message sent ✓" alert + back
4. Bij 4xx → "Could not send: {detail}" (validatie issue)
5. Bij 5xx of netwerk-fail → fallback naar mailto (native mail-app) of
   Gmail-web (als geen mail-app). User loopt nooit vast.

## Security

- **Geen JWT vereist** — anonieme gasten moeten ook support kunnen mailen
  (user die niet kan inloggen heeft juist hulp nodig)
- **Input-size limieten** in de function: subject ≤ 200, message ≤ 5000,
  category ≤ 100 chars
- **IP + User-Agent** worden gelogd in de email-body voor abuse-tracing
- **Geen credentials in response** — bij SMTP-fail return generieke error,
  detail alleen in Netlify function logs
- Bij spam-abuse: rate-limiting per IP toevoegen (later, alleen indien nodig)

## Rollback

Als support-endpoint issues geeft, operator kan in Netlify de function
disable'n (redirect verwijderen). De app valt dan automatisch terug op
de mailto-flow zoals voorheen. Geen data-verlies, geen blokkering.
