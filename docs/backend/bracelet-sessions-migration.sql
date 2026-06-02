-- ─────────────────────────────────────────────────────────────────────────────
-- VIBEZCORE — Bracelet sessions migration
-- Iter 9do (2026-05-31): backend sync voor history.
--
-- DEPLOY: Run in Supabase SQL Editor (Database → SQL Editor → New query).
-- IDEMPOTENT: kan meerdere keren gerund worden zonder issues.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Table ───────────────────────────────────────────────────────────────────
-- Per-user sessie-records. Eén row per voltooide/afgebroken bracelet-sessie.
-- Sync uit native app via /api/bracelet/sessions/sync endpoint.
CREATE TABLE IF NOT EXISTS public.bracelet_sessions (
  -- Client-generated UUID (consistent met local AsyncStorage record-IDs).
  -- TEXT i.p.v. UUID omdat lokale IDs niet altijd valide UUIDs zijn
  -- (Date.now() + Math.random base36). Geen referentie-druk hier.
  id TEXT PRIMARY KEY,

  -- Owner — koppelt aan auth.users via RLS. ON DELETE CASCADE → user
  -- delete (GDPR-right-to-be-forgotten) ruimt sessies automatisch op.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- BraceletMode index (0-4, matched ble-contract.ts).
  mode SMALLINT NOT NULL CHECK (mode BETWEEN 0 AND 4),

  -- Sessie-tijden.
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ NOT NULL,

  -- Werkelijk doorgebrachte minuten (afgerond) en geplande duur.
  duration_min SMALLINT NOT NULL CHECK (duration_min >= 0),
  planned_min  SMALLINT NOT NULL CHECK (planned_min >= 0),

  -- 'completed' = timer afgelopen, 'stopped' = user End.
  status TEXT NOT NULL CHECK (status IN ('completed', 'stopped')),

  -- Optionele breathwork-stats (JSON: {protocol, name, cyclesCompleted,
  -- cyclesTarget, durationSec}). NULL als geen breathwork in deze sessie.
  breathwork JSONB,

  -- Sync-metadata (last-write-wins conflict resolution).
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- Voor de meest-frequente queries: "haal alle sessies van user X sinds Y".
CREATE INDEX IF NOT EXISTS bracelet_sessions_user_updated_idx
  ON public.bracelet_sessions (user_id, updated_at DESC);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Een user mag ALLEEN z'n eigen sessies lezen/schrijven/wissen.
ALTER TABLE public.bracelet_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users select own sessions" ON public.bracelet_sessions;
CREATE POLICY "users select own sessions"
  ON public.bracelet_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own sessions" ON public.bracelet_sessions;
CREATE POLICY "users insert own sessions"
  ON public.bracelet_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own sessions" ON public.bracelet_sessions;
CREATE POLICY "users update own sessions"
  ON public.bracelet_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own sessions" ON public.bracelet_sessions;
CREATE POLICY "users delete own sessions"
  ON public.bracelet_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Trigger: auto-update updated_at on row change ───────────────────────────
CREATE OR REPLACE FUNCTION public.bracelet_sessions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Alleen overschrijven als client geen expliciete updated_at meestuurt
  -- (anders verstoort 't het last-write-wins protocol).
  IF NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bracelet_sessions_updated_at_trigger
  ON public.bracelet_sessions;
CREATE TRIGGER bracelet_sessions_updated_at_trigger
  BEFORE UPDATE ON public.bracelet_sessions
  FOR EACH ROW EXECUTE FUNCTION public.bracelet_sessions_set_updated_at();
