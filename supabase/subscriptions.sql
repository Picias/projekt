-- Subskrypcje ("Obserwuj") posłów i ustaw.
-- Uruchom w Supabase SQL Editor na istniejącej bazie.
--
-- user_id jest UUID z auth.users. RLS ogranicza odczyt i zapis do własnych
-- wierszy, a /api/subscriptions pyta bazę klientem sesji (nie service_role).

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('posel', 'ustawa')),
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created
  ON subscriptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_target
  ON subscriptions (target_type, target_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
CREATE POLICY "subscriptions_insert_own"
  ON subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
CREATE POLICY "subscriptions_update_own"
  ON subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;
CREATE POLICY "subscriptions_delete_own"
  ON subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE subscriptions TO authenticated;

-- Przeniesienie dotychczasowych obserwacji, o ile stare tabele istnieją
-- i user_id da się odczytać jako UUID konta.
DO $$
BEGIN
  IF to_regclass('public.obserwowani') IS NOT NULL THEN
    INSERT INTO subscriptions (user_id, target_type, target_id)
    SELECT DISTINCT user_id::uuid, 'posel', posel_id::text
    FROM obserwowani
    WHERE user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ON CONFLICT (user_id, target_type, target_id) DO NOTHING;
  END IF;

  IF to_regclass('public.obserwowane_ustawy') IS NOT NULL THEN
    INSERT INTO subscriptions (user_id, target_type, target_id)
    SELECT DISTINCT user_id::uuid, 'ustawa', ustawa_id::text
    FROM obserwowane_ustawy
    WHERE user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ON CONFLICT (user_id, target_type, target_id) DO NOTHING;
  END IF;
END $$;
