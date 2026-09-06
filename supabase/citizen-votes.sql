-- Głos Obywateli (SejmON) — sonda nad drukiem.
-- Uruchom w Supabase SQL Editor na istniejącej bazie.
--
-- Jeden zalogowany użytkownik ma jeden głos na druk (print_num).
-- Zmiana zdania nadpisuje wiersz przez upsert w /api/citizen-votes.

CREATE TABLE IF NOT EXISTS citizen_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  print_num TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('ZA', 'PRZECIW', 'WSTRZYMAL_SIE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT citizen_votes_user_print_key UNIQUE (user_id, print_num)
);

CREATE INDEX IF NOT EXISTS idx_citizen_votes_print_num
  ON citizen_votes (print_num);

ALTER TABLE citizen_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "citizen_votes_select_anon" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_select_authenticated" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_select_public" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_insert_anon" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_insert_own" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_update_anon" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_update_own" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_delete_anon" ON citizen_votes;
DROP POLICY IF EXISTS "citizen_votes_delete_own" ON citizen_votes;

CREATE POLICY "citizen_votes_select_public"
  ON citizen_votes FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "citizen_votes_insert_own"
  ON citizen_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "citizen_votes_update_own"
  ON citizen_votes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "citizen_votes_delete_own"
  ON citizen_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON TABLE citizen_votes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE citizen_votes TO authenticated;

-- Przeniesienie dotychczasowych głosów z glosy_obywateli.
-- Starsze wiersze mogły mieć UUID-y z localStorage, których nie ma w auth.users
-- — te pomijamy, bo FK na user_id tego wymaga.
DO $$
BEGIN
  IF to_regclass('public.glosy_obywateli') IS NOT NULL
     AND to_regclass('public.ustawy') IS NOT NULL THEN
    INSERT INTO citizen_votes (user_id, print_num, vote_type, created_at)
    SELECT DISTINCT ON (g.user_id, u.numer_druku)
      au.id,
      u.numer_druku,
      g.typ_glosu,
      g.oddano_at
    FROM glosy_obywateli g
    JOIN ustawy u ON u.id = g.ustawa_id
    JOIN auth.users au ON au.id = g.user_id::uuid
    WHERE g.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND g.typ_glosu IN ('ZA', 'PRZECIW', 'WSTRZYMAL_SIE')
    ORDER BY g.user_id, u.numer_druku, g.oddano_at DESC
    ON CONFLICT (user_id, print_num) DO NOTHING;
  END IF;
END $$;
