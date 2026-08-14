-- Schemat danych analitycznych posłów (SEJM ON, kadencja X)
-- Uruchom w Supabase SQL Editor po tabeli poslowie.

-- Dane profilowe posła wypełniane przez /api/sync-mps z API Sejmu.
-- Wiek liczymy w aplikacji z data_urodzenia, żeby nie trzymać w bazie
-- wartości, która dezaktualizuje się każdego roku.
-- Nazwisko trzymamy osobno, bo imie_nazwisko zawiera też drugie imię, a część
-- nazwisk jest dwuczłonowa ("Szynkowski vel Sęk") — bez tej kolumny nie da się
-- poprawnie posortować listy ani rozdzielić imienia od nazwiska w profilu.
ALTER TABLE poslowie ADD COLUMN IF NOT EXISTS nazwisko TEXT;
ALTER TABLE poslowie ADD COLUMN IF NOT EXISTS data_urodzenia DATE;
ALTER TABLE poslowie ADD COLUMN IF NOT EXISTS wyksztalcenie TEXT;
ALTER TABLE poslowie ADD COLUMN IF NOT EXISTS zawod TEXT;
ALTER TABLE poslowie ADD COLUMN IF NOT EXISTS okreg_wyborczy TEXT;
ALTER TABLE poslowie ADD COLUMN IF NOT EXISTS okreg_numer INTEGER;
ALTER TABLE poslowie ADD COLUMN IF NOT EXISTS liczba_glosow INTEGER;

-- Frekwencja posła (agregat z API /MP/{id}/votings/stats)
CREATE TABLE IF NOT EXISTS posel_frekwencja (
  posel_id INTEGER PRIMARY KEY REFERENCES poslowie(id) ON DELETE CASCADE,
  frekwencja_procent INTEGER,
  total_glosowan INTEGER NOT NULL DEFAULT 0,
  uczestniczyl_w INTEGER NOT NULL DEFAULT 0,
  zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ostatnie głosowania posła (+ szczegóły do deep-dive)
CREATE TABLE IF NOT EXISTS posel_glosowania (
  id BIGSERIAL PRIMARY KEY,
  posel_id INTEGER NOT NULL REFERENCES poslowie(id) ON DELETE CASCADE,
  sitting INTEGER NOT NULL,
  numer_glosowania INTEGER NOT NULL,
  data DATE NOT NULL,
  tytul TEXT,
  temat TEXT,
  opis TEXT,
  glos TEXT NOT NULL,
  wynik TEXT,
  glosy_za INTEGER,
  glosy_przeciw INTEGER,
  glosy_wstrzymal INTEGER,
  linia_klubu TEXT,
  zgodnosc_klubowa BOOLEAN,
  UNIQUE (posel_id, sitting, numer_glosowania)
);

CREATE INDEX IF NOT EXISTS idx_posel_glosowania_posel_data
  ON posel_glosowania (posel_id, data DESC);

-- Interpelacje posła
CREATE TABLE IF NOT EXISTS interpelacje (
  id INTEGER NOT NULL,
  posel_id INTEGER NOT NULL REFERENCES poslowie(id) ON DELETE CASCADE,
  tytul TEXT NOT NULL,
  data DATE,
  status TEXT,
  odbiorca TEXT,
  PRIMARY KEY (id, posel_id)
);

CREATE INDEX IF NOT EXISTS idx_interpelacje_posel_data
  ON interpelacje (posel_id, data DESC);

-- Średnie frekwencji klubów i Sejmu (precompute przy sync)
CREATE TABLE IF NOT EXISTS frekwencja_agregaty (
  klucz TEXT PRIMARY KEY,
  frekwencja_procent INTEGER,
  zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Druki sejmowe / projekty ustaw wraz z tłumaczeniem na język potoczny
CREATE TABLE IF NOT EXISTS ustawy (
  id BIGSERIAL PRIMARY KEY,
  numer_druku TEXT NOT NULL UNIQUE,
  tytul_oficjalny TEXT NOT NULL,
  autor TEXT,
  data_wplywu DATE,
  etap_legislacyjny TEXT NOT NULL DEFAULT 'projekt',
  -- Kolumny wypełniane przez warstwę tłumaczącą prawo na ludzki język
  opis_ludzki TEXT,
  kogo_dotyczy TEXT,
  co_zmienia TEXT,
  koszty_i_finansowanie TEXT,
  zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migracja dla baz, w których tabela ustawy powstała wcześniej w innym kształcie.
-- Starsza kolumna status zostaje nietknięta; etap pracy trzyma etap_legislacyjny.
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS autor TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS data_wplywu DATE;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS etap_legislacyjny TEXT NOT NULL DEFAULT 'projekt';
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS opis_ludzki TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS kogo_dotyczy TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS co_zmienia TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS koszty_i_finansowanie TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Starsza kolumna status nie jest już wypełniana przy synchronizacji,
-- więc nie może blokować zapisu wymogiem NOT NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ustawy'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE ustawy ALTER COLUMN status DROP NOT NULL;
  END IF;
END $$;

-- Upsert w /api/sync-ustawy rozpoznaje duplikaty po numerze druku
CREATE UNIQUE INDEX IF NOT EXISTS ustawy_numer_druku_key ON ustawy (numer_druku);

CREATE INDEX IF NOT EXISTS idx_ustawy_data_wplywu
  ON ustawy (data_wplywu DESC);

-- Posiedzenia Sejmu (moduł "Kalendarz obrad") wypełniane przez /api/sync-sessions.
--
-- Kluczem jest data rozpoczęcia, a nie numer posiedzenia z API. API Sejmu nadaje
-- number = 0 wszystkim terminom jeszcze nierozpoczętym oraz Zgromadzeniom
-- Narodowym (w kadencji X jest ich 11), więc upsert po numerze scaliłby wszystkie
-- przyszłe posiedzenia w jeden wiersz. Daty rozpoczęcia są w obrębie kadencji
-- unikalne, a gdy planowany termin dostanie swój numer, wiersz zaktualizuje się
-- w miejscu.
CREATE TABLE IF NOT EXISTS posiedzenia (
  id TEXT PRIMARY KEY,
  numer INTEGER NOT NULL DEFAULT 0,
  tytul TEXT NOT NULL,
  data_rozpoczecia DATE NOT NULL,
  data_zakonczenia DATE NOT NULL,
  zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pokrywa zapytanie o najbliższe posiedzenie na stronie głównej:
-- filtr data_zakonczenia >= dziś posortowany po data_rozpoczecia.
CREATE INDEX IF NOT EXISTS idx_posiedzenia_daty
  ON posiedzenia (data_zakonczenia, data_rozpoczecia);

-- Ustawy obserwowane przez użytkownika (user_id jak w tabeli obserwowani)
CREATE TABLE IF NOT EXISTS obserwowane_ustawy (
  user_id TEXT NOT NULL,
  ustawa_id BIGINT NOT NULL REFERENCES ustawy(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, ustawa_id)
);

-- RLS
--
-- Cały ruch do bazy idzie przez kod serwerowy (app/api oraz Server Components),
-- który łączy się kluczem SUPABASE_SERVICE_ROLE_KEY. Rola service_role omija RLS,
-- więc rola anon nie potrzebuje już żadnych uprawnień do zapisu — zostaje jej
-- tylko odczyt danych, które i tak są publiczne.
ALTER TABLE posel_frekwencja ENABLE ROW LEVEL SECURITY;
ALTER TABLE posel_glosowania ENABLE ROW LEVEL SECURITY;
ALTER TABLE interpelacje ENABLE ROW LEVEL SECURITY;
ALTER TABLE frekwencja_agregaty ENABLE ROW LEVEL SECURITY;
ALTER TABLE ustawy ENABLE ROW LEVEL SECURITY;
ALTER TABLE posiedzenia ENABLE ROW LEVEL SECURITY;
ALTER TABLE obserwowane_ustawy ENABLE ROW LEVEL SECURITY;

-- Polityki idempotentne — plik można uruchamiać wielokrotnie
DROP POLICY IF EXISTS "posel_frekwencja_select_anon" ON posel_frekwencja;
CREATE POLICY "posel_frekwencja_select_anon"
  ON posel_frekwencja FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "posel_glosowania_select_anon" ON posel_glosowania;
CREATE POLICY "posel_glosowania_select_anon"
  ON posel_glosowania FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "interpelacje_select_anon" ON interpelacje;
CREATE POLICY "interpelacje_select_anon"
  ON interpelacje FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "frekwencja_agregaty_select_anon" ON frekwencja_agregaty;
CREATE POLICY "frekwencja_agregaty_select_anon"
  ON frekwencja_agregaty FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "ustawy_select_anon" ON ustawy;
CREATE POLICY "ustawy_select_anon"
  ON ustawy FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "posiedzenia_select_anon" ON posiedzenia;
CREATE POLICY "posiedzenia_select_anon"
  ON posiedzenia FOR SELECT TO anon USING (true);

-- Wcześniejsze wersje schematu dawały anon prawo zapisu, bo synchronizacja
-- działała na kluczu publicznym. Teraz te polityki są zbędne.
DROP POLICY IF EXISTS "posel_frekwencja_insert_anon" ON posel_frekwencja;
DROP POLICY IF EXISTS "posel_frekwencja_update_anon" ON posel_frekwencja;
DROP POLICY IF EXISTS "posel_glosowania_insert_anon" ON posel_glosowania;
DROP POLICY IF EXISTS "posel_glosowania_update_anon" ON posel_glosowania;
DROP POLICY IF EXISTS "posel_glosowania_delete_anon" ON posel_glosowania;
DROP POLICY IF EXISTS "interpelacje_insert_anon" ON interpelacje;
DROP POLICY IF EXISTS "interpelacje_update_anon" ON interpelacje;
DROP POLICY IF EXISTS "frekwencja_agregaty_insert_anon" ON frekwencja_agregaty;
DROP POLICY IF EXISTS "frekwencja_agregaty_update_anon" ON frekwencja_agregaty;
DROP POLICY IF EXISTS "ustawy_insert_anon" ON ustawy;
DROP POLICY IF EXISTS "ustawy_update_anon" ON ustawy;

-- Lista obserwowanych druków jest prywatna i obsługuje ją wyłącznie
-- /api/obserwowane-ustawy, więc anon nie dostaje do niej żadnej polityki.
DROP POLICY IF EXISTS "obserwowane_ustawy_select_anon" ON obserwowane_ustawy;
DROP POLICY IF EXISTS "obserwowane_ustawy_insert_anon" ON obserwowane_ustawy;
DROP POLICY IF EXISTS "obserwowane_ustawy_delete_anon" ON obserwowane_ustawy;
