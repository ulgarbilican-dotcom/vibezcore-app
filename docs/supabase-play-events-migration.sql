-- ─────────────────────────────────────────────────────────────────────────
-- VIBEZCORE — play_events migration (2026-06-19)
--
-- Anonymous aggregate playback tracking. Klanten loggen elke session-start
-- met een anoniem device token (random UUID, geen account-link). Privacy
-- Policy sectie 03 "Monitoring platform performance and usage patterns"
-- dekt deze data.
--
-- WAT VERZAMEL JE:
--   - Welke sessie (session_id = audio URL of slug)
--   - Wanneer gestart (played_at, server-side)
--   - Anonieme device token (random per install, geen user_id)
--   - Optioneel: duration_seconds (hoe lang geluisterd, voor "completion rate")
--
-- WAT JE NIET VERZAMELT:
--   - User ID / account email
--   - IP-adres (Supabase strip dat automatisch)
--   - Device fingerprint
--   - Location
--
-- HOW TO APPLY:
--   1. Open Supabase project dashboard
--   2. SQL Editor → New query
--   3. Plak deze hele file
--   4. Run
--
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.play_events (
  id         bigserial primary key,
  session_id text        not null,
  played_at  timestamptz not null default now(),
  anon_token text        not null,
  duration_seconds int   null
);

create index if not exists idx_play_events_session
  on public.play_events(session_id);

create index if not exists idx_play_events_date
  on public.play_events(played_at desc);

create index if not exists idx_play_events_anon
  on public.play_events(anon_token);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS: anon role mag INSERT (clients loggen events), geen SELECT/UPDATE/
-- DELETE (alleen jij via service_role / SQL editor).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.play_events enable row level security;

-- Drop existing policy if rerunning migration
drop policy if exists play_events_insert_anon on public.play_events;

create policy play_events_insert_anon
  on public.play_events
  for insert
  to anon, authenticated
  with check (
    -- Sanity guards: session_id niet leeg, anon_token redelijke lengte
    length(session_id) > 0
    and length(session_id) < 500
    and length(anon_token) > 10
    and length(anon_token) < 100
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Handige views voor je dashboard queries
-- ─────────────────────────────────────────────────────────────────────────

create or replace view public.v_session_popularity as
  select
    session_id,
    count(*)               as total_plays,
    count(distinct anon_token) as unique_devices,
    max(played_at)         as last_played
  from public.play_events
  group by session_id
  order by total_plays desc;

create or replace view public.v_play_stats_daily as
  select
    date_trunc('day', played_at) as day,
    count(*)                     as plays,
    count(distinct anon_token)   as unique_devices,
    count(distinct session_id)   as unique_sessions
  from public.play_events
  group by 1
  order by 1 desc;

-- ─────────────────────────────────────────────────────────────────────────
-- Dashboard queries (kopieer in Supabase SQL editor wanneer je inzichten wil)
-- ─────────────────────────────────────────────────────────────────────────

-- Top 10 meest beluisterde sessies
-- SELECT * FROM public.v_session_popularity LIMIT 10;

-- Gemiddeld plays per sessie
-- SELECT round(avg(total_plays))::int as avg_plays_per_session
-- FROM public.v_session_popularity;

-- Plays per dag laatste 30 dagen
-- SELECT * FROM public.v_play_stats_daily
-- WHERE day > now() - interval '30 days';

-- Top sessies laatste 7 dagen
-- SELECT session_id, count(*) as plays
-- FROM public.play_events
-- WHERE played_at > now() - interval '7 days'
-- GROUP BY session_id
-- ORDER BY plays DESC
-- LIMIT 10;
