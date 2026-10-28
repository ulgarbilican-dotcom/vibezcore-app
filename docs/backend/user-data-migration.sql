-- ─────────────────────────────────────────────────────────────────────────────
-- VIBEZCORE — Backup & Sync: tabel `user_data`
-- 26 okt 2026 (operator: "ja bouwen backup en sync")
--
-- DEPLOY: Supabase Dashboard → SQL Editor → New query → plak dit hele bestand → Run.
-- IDEMPOTENT: mag meerdere keren gerund worden.
--
-- WAT: één rij per gebruiker PER ONDERDEEL (key), met een JSON-waarde:
--   settings        voorkeuren, doelen, niveau, onboarding-vlaggen, gratis-sessie-vlaggen
--   resting_pulse   rusthartslag (welzijn, geen medische meting)
--   breath_history  afgeronde ademsessies + totalen
--   plan            actief plan
--   state_history   State Control-sessies                          (toegevoegd 28 okt 2026)
--   audio           favorieten, beluisterde sessies, hervatposities (toegevoegd 28 okt 2026)
-- De app praat rechtstreeks met Supabase REST met de login-token van de gebruiker;
-- RLS zorgt dat iedereen alleen de eigen rijen ziet/schrijft/wist.
-- Account verwijderen = rijen verdwijnen automatisch (ON DELETE CASCADE).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_data (
  user_id    UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key        TEXT        NOT NULL CHECK (key IN ('settings', 'resting_pulse', 'breath_history', 'plan', 'state_history', 'audio')),
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_data select own" ON public.user_data;
CREATE POLICY "user_data select own" ON public.user_data
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_data insert own" ON public.user_data;
CREATE POLICY "user_data insert own" ON public.user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_data update own" ON public.user_data;
CREATE POLICY "user_data update own" ON public.user_data
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_data delete own" ON public.user_data;
CREATE POLICY "user_data delete own" ON public.user_data
  FOR DELETE USING (auth.uid() = user_id);

-- De server-klok bepaalt updated_at (niet de klok van het toestel): zo kan een
-- verkeerd ingestelde telefoonklok de volgorde van wijzigingen nooit verstoren.
CREATE OR REPLACE FUNCTION public.user_data_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_data_touch_trigger ON public.user_data;
CREATE TRIGGER user_data_touch_trigger
  BEFORE INSERT OR UPDATE ON public.user_data
  FOR EACH ROW EXECUTE FUNCTION public.user_data_touch();

-- Alleen ingelogde gebruikers; anonieme sleutel mag niets met deze tabel.
REVOKE ALL ON public.user_data FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 28 okt 2026 — BESTAANDE TABEL BIJWERKEN (State Control-sessies + Audio Library)
--
-- Is de tabel al aangemaakt met de oude lijst van vier onderdelen, dan weigert de server de nieuwe
-- ('state_history', 'audio') totdat de lijst hieronder is bijgewerkt. De app blijft werken en probeert het
-- dan niet eindeloos opnieuw; zodra dit gerund is, begint de back-up van die twee onderdelen vanzelf.
-- IDEMPOTENT: mag meerdere keren gerund worden. Verwijdert geen enkele rij.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE c RECORD;
BEGIN
  -- Zoek de bestaande controle op kolom `key` (de naam is automatisch gekozen) en verwijder die.
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'user_data' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%key%IN%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_data DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE public.user_data
    ADD CONSTRAINT user_data_key_check
    CHECK (key IN ('settings', 'resting_pulse', 'breath_history', 'plan', 'state_history', 'audio'));
END $$;
