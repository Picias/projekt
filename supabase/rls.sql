-- SejmON — Row Level Security
-- Uruchom w Supabase SQL Editor. Skrypt jest idempotentny.
--
-- service_role (Smart CRON, /api/* z SUPABASE_SERVICE_ROLE_KEY) omija RLS.
-- Poniższe polityki dotyczą ról anon i authenticated (klient przeglądarki).
--
-- Mapowanie nazw:
--   bills / druki     → ustawy
--   votings           → glosowania
--   profiles          → profile  (PK: id = auth.users.id)

-- ---------------------------------------------------------------------------
-- 1. citizen_votes — sonda obywatelska
--    Odczyt wyników jest publiczny. Zapis / zmiana / usunięcie tylko własne.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. subscriptions — obserwowani posłowie i ustawy
--    Całkowicie prywatne: nikt nie czyta cudzej listy.
-- ---------------------------------------------------------------------------

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;

CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_insert_own"
  ON subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_update_own"
  ON subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_delete_own"
  ON subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE subscriptions TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. profile — dane demograficzne obywatela (PK id = auth.uid())
--    SELECT / INSERT / UPDATE wyłącznie właściciela.
-- ---------------------------------------------------------------------------

ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_select_public" ON profile;
DROP POLICY IF EXISTS "profile_select_own" ON profile;
DROP POLICY IF EXISTS "profile_insert_own" ON profile;
DROP POLICY IF EXISTS "profile_update_own" ON profile;
DROP POLICY IF EXISTS "profile_delete_own" ON profile;

CREATE POLICY "profile_select_own"
  ON profile FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profile_insert_own"
  ON profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profile_update_own"
  ON profile FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE ALL ON TABLE profile FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE profile TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tabele systemowe (druki / głosowania / katalog posłów)
--    SELECT publiczny. INSERT / UPDATE / DELETE bez polityk — zablokowane
--    dla anon i authenticated. Zapis idzie wyłącznie przez service_role.
-- ---------------------------------------------------------------------------

ALTER TABLE ustawy ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosowania ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosy_poslow ENABLE ROW LEVEL SECURITY;
ALTER TABLE poslowie ENABLE ROW LEVEL SECURITY;
ALTER TABLE posiedzenia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ustawy_select_anon" ON ustawy;
DROP POLICY IF EXISTS "ustawy_select_public" ON ustawy;
DROP POLICY IF EXISTS "ustawy_insert_anon" ON ustawy;
DROP POLICY IF EXISTS "ustawy_update_anon" ON ustawy;
DROP POLICY IF EXISTS "ustawy_delete_anon" ON ustawy;

CREATE POLICY "ustawy_select_public"
  ON ustawy FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "glosowania_select_anon" ON glosowania;
DROP POLICY IF EXISTS "glosowania_select_public" ON glosowania;
DROP POLICY IF EXISTS "glosowania_insert_anon" ON glosowania;
DROP POLICY IF EXISTS "glosowania_update_anon" ON glosowania;
DROP POLICY IF EXISTS "glosowania_delete_anon" ON glosowania;

CREATE POLICY "glosowania_select_public"
  ON glosowania FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "glosy_poslow_select_anon" ON glosy_poslow;
DROP POLICY IF EXISTS "glosy_poslow_select_public" ON glosy_poslow;
DROP POLICY IF EXISTS "glosy_poslow_insert_anon" ON glosy_poslow;
DROP POLICY IF EXISTS "glosy_poslow_update_anon" ON glosy_poslow;
DROP POLICY IF EXISTS "glosy_poslow_delete_anon" ON glosy_poslow;

CREATE POLICY "glosy_poslow_select_public"
  ON glosy_poslow FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "poslowie_select_anon" ON poslowie;
DROP POLICY IF EXISTS "poslowie_select_public" ON poslowie;
DROP POLICY IF EXISTS "poslowie_insert_anon" ON poslowie;
DROP POLICY IF EXISTS "poslowie_update_anon" ON poslowie;
DROP POLICY IF EXISTS "poslowie_delete_anon" ON poslowie;

CREATE POLICY "poslowie_select_public"
  ON poslowie FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "posiedzenia_select_anon" ON posiedzenia;
DROP POLICY IF EXISTS "posiedzenia_select_public" ON posiedzenia;
DROP POLICY IF EXISTS "posiedzenia_insert_anon" ON posiedzenia;
DROP POLICY IF EXISTS "posiedzenia_update_anon" ON posiedzenia;
DROP POLICY IF EXISTS "posiedzenia_delete_anon" ON posiedzenia;

CREATE POLICY "posiedzenia_select_public"
  ON posiedzenia FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE ustawy TO anon, authenticated;
GRANT SELECT ON TABLE glosowania TO anon, authenticated;
GRANT SELECT ON TABLE glosy_poslow TO anon, authenticated;
GRANT SELECT ON TABLE poslowie TO anon, authenticated;
GRANT SELECT ON TABLE posiedzenia TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE ustawy FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE glosowania FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE glosy_poslow FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE poslowie FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE posiedzenia FROM anon, authenticated;
