# Bracelet sessions sync — backend deployment

> **Status**: app-code is af (iter 9do 2026-05-31). Backend wacht op deployment.
> Zodra onderstaande 3 stappen klaar zijn, syncen sessies automatisch tussen
> toestellen voor real-user accounts.

## Wat dit oplost

Voorheen werd sessie-history alleen lokaal opgeslagen in AsyncStorage. Een
user die op een nieuw toestel inlogde, zag een lege history. Met deze sync:

- ✅ History volgt het account, niet het toestel
- ✅ Cross-device — telefoon kapot, log in op nieuwe = je sessies komen mee
- ✅ Local-first — app werkt volledig offline, syncen wanneer er netwerk is
- ✅ Conflict-resolution via last-write-wins op `updatedAt`
- ✅ Dev-overrides en gasten blijven puur lokaal (geen backend-roundtrip)

## Step 1 — Supabase SQL migration

Open Supabase Dashboard → SQL Editor → New query, paste de volledige inhoud
van `bracelet-sessions-migration.sql` en run.

Dit:
- Maakt tabel `public.bracelet_sessions`
- Zet indexes voor performance
- Enables RLS met 4 policies (select/insert/update/delete = `auth.uid()`)
- Voegt update-trigger toe voor `updated_at`

Idempotent — kan meerdere keren gerund worden zonder problemen.

## Step 2 — Netlify function deploy

Kopieer `api-bracelet-sessions-sync.js` naar je Netlify functions folder
(typisch `netlify/functions/bracelet-sessions-sync.js` in de backend repo).

Voeg in `netlify.toml` (of via `_redirects`) een route toe:

```toml
[[redirects]]
  from = "/api/bracelet/sessions/sync"
  to   = "/.netlify/functions/bracelet-sessions-sync"
  status = 200
  force  = true
```

ENV vars (Netlify → Site settings → Environment variables):
- `SUPABASE_URL` = je project URL (vbnb https://abcd1234.supabase.co)
- `SUPABASE_ANON_KEY` = publieke anon key

Backend deps (in `package.json` van backend repo):
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x"
  }
}
```

Deploy zoals normaal (`git push` naar main of via Netlify CLI).

## Step 3 — Test

Open Postman (of curl) en doe:

```bash
curl -X POST https://app.vibezcore.com/api/bracelet/sessions/sync \
  -H "Authorization: Bearer <real-supabase-token>" \
  -H "Content-Type: application/json" \
  -d '{"push": [], "since": null}'
```

Verwachte response (eerste keer, lege server):
```json
{
  "pushed": 0,
  "pulled": [],
  "conflicts": [],
  "serverTime": "2026-05-31T..."
}
```

## Wat de native app doet

`src/utils/bracelet-history-sync.ts` orchestreert:

| Trigger | Wat gebeurt |
|---|---|
| `recordSession()` | Best-effort push de nieuwe record |
| `refreshUserBucket()` (sign-in/out, override switch) | Pull alle records van de nieuwe user |
| (toekomstig: pull-to-refresh op history-pagina) | Trigger handmatige `syncAll()` |

Sync is **silent-fail** — bij netwerk/auth/server-fouten blijven records
lokaal staan met `syncedAt: null`, en proberen we het de volgende keer
opnieuw. Geen data-verlies, geen blokkering.

## Schema mapping (client ↔ DB)

| Client (camelCase) | DB (snake_case) |
|---|---|
| `id` | `id` (TEXT) |
| — | `user_id` (UUID, server-only, uit JWT) |
| `mode` | `mode` (SMALLINT) |
| `startedAt` | `started_at` (TIMESTAMPTZ) |
| `endedAt` | `ended_at` (TIMESTAMPTZ) |
| `durationMin` | `duration_min` (SMALLINT) |
| `plannedMin` | `planned_min` (SMALLINT) |
| `status` | `status` (TEXT) |
| `breathwork` | `breathwork` (JSONB) |
| `updatedAt` | `updated_at` (TIMESTAMPTZ) |
| `syncedAt` | — (client-only, set bij succesvolle sync) |

## Rollback

Als sync issues geeft, kan operator de Netlify function disable'n
(redirect verwijderen). De app blijft dan offline-only werken zoals
voorheen — `syncAll()` returnt silent fail, records blijven lokaal.
SQL tabel kan blijven staan (geen impact zolang clients 'm niet
benaderen).
