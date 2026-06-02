/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet sessions sync endpoint
   Iter 9do (2026-05-31)

   DEPLOY: kopieer naar je Netlify functions folder (typisch
   `netlify/functions/bracelet-sessions-sync.js`) en deploy.
   ROUTE in netlify.toml of redirects:
     /api/bracelet/sessions/sync -> /.netlify/functions/bracelet-sessions-sync

   PROTOCOL
   ────────
   POST /api/bracelet/sessions/sync
   Headers:
     Authorization: Bearer {supabase_access_token}
     Content-Type: application/json
   Body:
     {
       "push":  [<SessionRecord>],   // records uit lokale cache waar
                                     // syncedAt === null (pending push)
       "since": "<iso-timestamp>"    // OPTIONAL — pull alle records die
                                     // sinds dit moment ge-update zijn
                                     // (voor cross-device sync; eerst
                                     //  sync = null = pull alles)
     }
   Response:
     {
       "pushed":      <number>,           // hoeveel records opgeslagen
       "pulled":      [<SessionRecord>],  // server-records die client
                                          // mogelijk nog niet had
       "serverTime":  "<iso-timestamp>",  // nieuwe "since" cursor
       "conflicts":   [<SessionRecord>]   // server-versies die nieuwer
                                          // waren dan client (last-write-
                                          // wins toegepast, client moet
                                          // z'n local versies overschrijven)
     }

   AUTH
   ────
   Gebruikt de Supabase JWT die de native app meestuurt. RLS-policies in
   bracelet_sessions zorgen dat een user alleen z'n eigen records ziet.

   DEPS (in package.json van backend repo):
     @supabase/supabase-js
   ENV VARS (in Netlify):
     SUPABASE_URL
     SUPABASE_ANON_KEY  (publieke anon key, RLS doet authorization)
   ───────────────────────────────────────────────────────────────────── */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

exports.handler = async (event) => {
  /* CORS preflight. */
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json(401, { error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);

  /* Per-request Supabase client met user JWT — RLS-policies werken nu. */
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  /* Valideer token + haal user-id. */
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json(401, { error: 'Invalid or expired token' });
  }
  const userId = userData.user.id;

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  const push = Array.isArray(body.push) ? body.push : [];
  const since = typeof body.since === 'string' ? body.since : null;

  /* ── PUSH: upsert client records ─────────────────────────────────────
     last-write-wins: client's updated_at gewint als 't later is dan
     bestaande row. Anders behoudt server z'n eigen versie en wordt 'm
     teruggegeven als "conflict" zodat client kan overschrijven. */
  const conflicts = [];
  let pushed = 0;

  if (push.length > 0) {
    /* Map client schema → DB schema. */
    const rows = push.map((r) => ({
      id: r.id,
      user_id: userId,
      mode: r.mode,
      started_at: r.startedAt,
      ended_at: r.endedAt,
      duration_min: r.durationMin,
      planned_min: r.plannedMin,
      status: r.status,
      breathwork: r.breathwork ?? null,
      updated_at: r.updatedAt || new Date().toISOString(),
    }));

    /* Bestaande server-versies ophalen voor conflict-detectie. */
    const ids = rows.map((r) => r.id);
    const { data: existing } = await supabase
      .from('bracelet_sessions')
      .select('id, updated_at')
      .in('id', ids);
    const existingMap = new Map((existing || []).map((e) => [e.id, e.updated_at]));

    /* Splits rows in "kan upserten" vs "server is nieuwer → conflict". */
    const toUpsert = [];
    for (const row of rows) {
      const serverUpdatedAt = existingMap.get(row.id);
      if (!serverUpdatedAt) {
        toUpsert.push(row);
      } else if (new Date(row.updated_at) >= new Date(serverUpdatedAt)) {
        toUpsert.push(row);
      } else {
        /* Server is nieuwer — niet upserten, return als conflict. */
        const { data: serverRow } = await supabase
          .from('bracelet_sessions')
          .select('*')
          .eq('id', row.id)
          .single();
        if (serverRow) conflicts.push(toClientSchema(serverRow));
      }
    }

    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase
        .from('bracelet_sessions')
        .upsert(toUpsert, { onConflict: 'id' });
      if (upsertErr) {
        return json(500, { error: 'Upsert failed', detail: upsertErr.message });
      }
      pushed = toUpsert.length;
    }
  }

  /* ── PULL: records die ge-update zijn sinds `since` ──────────────────
     Voor first-sync (since=null) pull alles. Voor latere syncs alleen
     delta. RLS zorgt dat alleen own records komen. Cap op 1000 om
     network/latency te bewaken. */
  let pulled = [];
  {
    let q = supabase
      .from('bracelet_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1000);
    if (since) q = q.gt('updated_at', since);
    const { data: pulledRows, error: pullErr } = await q;
    if (pullErr) {
      return json(500, { error: 'Pull failed', detail: pullErr.message });
    }
    pulled = (pulledRows || []).map(toClientSchema);
  }

  return json(200, {
    pushed,
    pulled,
    conflicts,
    serverTime: new Date().toISOString(),
  });
};

/* ── Schema mapping ──────────────────────────────────────────────────── */
function toClientSchema(dbRow) {
  return {
    id: dbRow.id,
    mode: dbRow.mode,
    startedAt: dbRow.started_at,
    endedAt: dbRow.ended_at,
    durationMin: dbRow.duration_min,
    plannedMin: dbRow.planned_min,
    status: dbRow.status,
    breathwork: dbRow.breathwork || undefined,
    updatedAt: dbRow.updated_at,
    syncedAt: new Date().toISOString(),
  };
}

function json(status, body) {
  return {
    statusCode: status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
