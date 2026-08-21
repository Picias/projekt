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
  -- Bezpośredni odnośnik do skanu druku (załącznik PDF z API Sejmu)
  pdf_url TEXT,
  -- Tematyka druku. Pusta do czasu podłączenia modelu, który będzie ją nadawał
  -- na podstawie treści — filtry na liście ustaw czytają już z tej kolumny.
  tagi TEXT[] NOT NULL DEFAULT '{}',
  -- Kolumny wypełniane przez warstwę tłumaczącą prawo na ludzki język
  opis_ludzki TEXT,
  kogo_dotyczy TEXT,
  co_zmienia TEXT,
  koszty_i_finansowanie TEXT,
  -- Podsumowania z modelu: oryginalny PDF (Uzasadnienie i tabele OSR).
  -- Null do czasu wywołania /api/generate-ai.
  ai_w_skrocie TEXT,
  ai_kogo_dotyczy TEXT,
  ai_co_zmienia TEXT,
  ai_skad_pieniadze TEXT,
  zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migracja dla baz, w których tabela ustawy powstała wcześniej w innym kształcie.
-- Starsza kolumna status zostaje nietknięta; etap pracy trzyma etap_legislacyjny.
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS autor TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS data_wplywu DATE;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS etap_legislacyjny TEXT NOT NULL DEFAULT 'projekt';
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS tagi TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS opis_ludzki TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS kogo_dotyczy TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS co_zmienia TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS koszty_i_finansowanie TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS ai_w_skrocie TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS ai_kogo_dotyczy TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS ai_co_zmienia TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS ai_skad_pieniadze TEXT;
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Licznik obserwujących trzymamy przy druku, mimo że da się go policzyć
-- z obserwowane_ustawy. Sekcja „Gorące projekty” sortuje po nim całą tabelę
-- ustaw przy każdym wejściu na stronę główną, a tego nie da się zrobić
-- wydajnie po agregacie z drugiej tabeli.
ALTER TABLE ustawy ADD COLUMN IF NOT EXISTS liczba_obserwujacych INTEGER NOT NULL DEFAULT 0;

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

-- Filtry listy ustaw: etap i wnioskodawca zawężają zbiór przed sortowaniem,
-- a tagi sprawdzamy operatorem zawierania (@>), który potrzebuje indeksu GIN.
CREATE INDEX IF NOT EXISTS idx_ustawy_etap
  ON ustawy (etap_legislacyjny);

CREATE INDEX IF NOT EXISTS idx_ustawy_autor
  ON ustawy (autor);

CREATE INDEX IF NOT EXISTS idx_ustawy_tagi
  ON ustawy USING GIN (tagi);

-- „Gorące projekty”: trzy druki z największą liczbą obserwujących.
CREATE INDEX IF NOT EXISTS idx_ustawy_liczba_obserwujacych
  ON ustawy (liczba_obserwujacych DESC);

-- Wczesny prototyp tabeli glosowania trzymał pojedynczy głos posła
-- (posel_id, glos) — to, co dziś robi glosy_poslow. Usuwamy go, żeby nazwa
-- mogła opisywać całe głosowanie, ale wyłącznie gdy nie ma w nim danych;
-- warunek na posel_id odróżnia prototyp od tabeli w obecnym kształcie.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'glosowania'
      AND column_name = 'posel_id'
  ) AND NOT EXISTS (SELECT 1 FROM glosowania LIMIT 1) THEN
    DROP TABLE glosowania CASCADE;
  END IF;
END $$;

-- Głosowania Sejmu nad drukami, wypełniane przez /api/sync-votings.
--
-- Parą naturalną jest (sitting, numer_glosowania) z API Sejmu — to po niej
-- rozpoznajemy duplikaty przy ponownej synchronizacji, bo id z BIGSERIAL
-- zmieniłoby się przy każdym przebiegu.
--
-- Jedno głosowanie wskazuje na jeden druk, choć tytuły potrafią wymieniać ich
-- kilka ("druki nr 2634, 2644 i 2644-A"). Bierzemy pierwszy numer, który mamy
-- w tabeli ustawy — tabela pośrednia byłaby tu nadmiarowa, bo pozostałe druki
-- to zwykle autopoprawki do tego samego projektu.
CREATE TABLE IF NOT EXISTS glosowania (
  id BIGSERIAL PRIMARY KEY,
  ustawa_id BIGINT NOT NULL REFERENCES ustawy(id) ON DELETE CASCADE,
  sitting INTEGER NOT NULL,
  numer_glosowania INTEGER NOT NULL,
  tytul TEXT NOT NULL,
  temat TEXT,
  data_glosowania TIMESTAMPTZ,
  za INTEGER NOT NULL DEFAULT 0,
  przeciw INTEGER NOT NULL DEFAULT 0,
  wstrzymalo_sie INTEGER NOT NULL DEFAULT 0,
  nieobecni INTEGER NOT NULL DEFAULT 0,
  zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migracja dla baz, w których tabela powstała wcześniej w innym kształcie.
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS sitting INTEGER;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS numer_glosowania INTEGER;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS tytul TEXT;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS temat TEXT;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS za INTEGER NOT NULL DEFAULT 0;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS przeciw INTEGER NOT NULL DEFAULT 0;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS wstrzymalo_sie INTEGER NOT NULL DEFAULT 0;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS nieobecni INTEGER NOT NULL DEFAULT 0;
ALTER TABLE glosowania ADD COLUMN IF NOT EXISTS zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Cel konfliktu dla upsertu w /api/sync-votings. Jako osobny indeks, bo
-- ograniczenie z CREATE TABLE nie powstanie na już istniejącej tabeli.
CREATE UNIQUE INDEX IF NOT EXISTS glosowania_sitting_numer_key
  ON glosowania (sitting, numer_glosowania);

-- Ekran wyników bierze najnowsze głosowanie nad danym drukiem.
CREATE INDEX IF NOT EXISTS idx_glosowania_ustawa_data
  ON glosowania (ustawa_id, data_glosowania DESC);

-- Lista imienna: głos każdego posła w danym głosowaniu.
CREATE TABLE IF NOT EXISTS glosy_poslow (
  id BIGSERIAL PRIMARY KEY,
  glosowanie_id BIGINT NOT NULL REFERENCES glosowania(id) ON DELETE CASCADE,
  posel_id INTEGER NOT NULL REFERENCES poslowie(id) ON DELETE CASCADE,
  -- Klub zapisujemy w postaci z API ("PiS", "PSL-TD"), bo poseł mógł zmienić
  -- przynależność po głosowaniu — kolumna partia w tabeli poslowie trzyma stan
  -- bieżący, a tutaj potrzebny jest stan z dnia głosowania.
  klub TEXT,
  glos TEXT NOT NULL CHECK (glos IN ('ZA', 'PRZECIW', 'WSTRZYMAL_SIE', 'NIEOBECNY'))
);

CREATE UNIQUE INDEX IF NOT EXISTS glosy_poslow_glosowanie_posel_key
  ON glosy_poslow (glosowanie_id, posel_id);

CREATE INDEX IF NOT EXISTS idx_glosy_poslow_posel
  ON glosy_poslow (posel_id);

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

-- Uzupełnienie licznika w bazach, w których obserwowane druki istniały już
-- przed dodaniem kolumny. Przeliczenie jest idempotentne, więc plik można
-- uruchamiać wielokrotnie.
UPDATE ustawy u
SET liczba_obserwujacych = (
  SELECT COUNT(*) FROM obserwowane_ustawy o WHERE o.ustawa_id = u.id
);

-- Sonda obywatelska („Głos Obywateli”) — opinia czytelników o druku, zupełnie
-- niezależna od głosowania posłów w tabeli posel_glosowania.
--
-- user_id to UUID z auth.users po zalogowaniu. Starsze głosy z localStorage
-- zostają w tabeli, ale nowe zapisy idą wyłącznie z sesji.
CREATE TABLE IF NOT EXISTS glosy_obywateli (
  id BIGSERIAL PRIMARY KEY,
  ustawa_id BIGINT NOT NULL REFERENCES ustawy(id) ON DELETE CASCADE,
  user_id TEXT,
  typ_glosu TEXT NOT NULL CHECK (typ_glosu IN ('ZA', 'PRZECIW', 'WSTRZYMAL_SIE')),
  oddano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jeden głos na druk na użytkownika: zmiana zdania nadpisuje wiersz przez
-- upsert w /api/glosy-obywateli. Postgres traktuje NULL-e jako różne, więc
-- indeks nie blokuje głosów oddanych bez identyfikatora.
CREATE UNIQUE INDEX IF NOT EXISTS glosy_obywateli_ustawa_user_key
  ON glosy_obywateli (ustawa_id, user_id);

-- Zliczanie proporcji Za/Przeciw/Wstrzymał się dla jednego druku.
CREATE INDEX IF NOT EXISTS idx_glosy_obywateli_ustawa
  ON glosy_obywateli (ustawa_id);

-- Profile obywateli powiązane 1:1 z kontem w auth.users.
-- Pola demograficzne i osobowe są puste do czasu onboardingu; flagi pokaz_*
-- sterują tym, co wolno wyświetlić na publicznym profilu (domyślnie nic).
-- Pseudonim może zastąpić imię i nazwisko w aplikacji, gdy dane osobowe
-- są ukryte albo nieuzupełnione.
CREATE TABLE IF NOT EXISTS profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  imie TEXT,
  nazwisko TEXT,
  pseudonim TEXT,
  avatar_url TEXT,
  plec TEXT,
  rok_urodzenia INTEGER,
  wyksztalcenie TEXT,
  wielkosc_miejscowosci TEXT,
  popierana_partia TEXT,
  pokaz_dane_osobowe BOOLEAN NOT NULL DEFAULT false,
  pokaz_plec BOOLEAN NOT NULL DEFAULT false,
  pokaz_wiek BOOLEAN NOT NULL DEFAULT false,
  pokaz_wyksztalcenie BOOLEAN NOT NULL DEFAULT false,
  pokaz_miejscowosc BOOLEAN NOT NULL DEFAULT false,
  pokaz_partie BOOLEAN NOT NULL DEFAULT false,
  zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profile ADD COLUMN IF NOT EXISTS imie TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS nazwisko TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pseudonim TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS plec TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS rok_urodzenia INTEGER;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS wyksztalcenie TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS wielkosc_miejscowosci TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS popierana_partia TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pokaz_dane_osobowe BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pokaz_plec BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pokaz_wiek BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pokaz_wyksztalcenie BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pokaz_miejscowosc BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS pokaz_partie BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS zaktualizowano_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Nowy użytkownik dostaje pusty wiersz profilu, żeby onboarding mógł zrobić
-- UPDATE zamiast zgadywać, czy rekord już istnieje.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_profile();

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
ALTER TABLE glosowania ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosy_poslow ENABLE ROW LEVEL SECURITY;
ALTER TABLE obserwowane_ustawy ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosy_obywateli ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

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

-- Wyniki głosowań są jawne z mocy regulaminu Sejmu, więc anon może je czytać.
DROP POLICY IF EXISTS "glosowania_select_anon" ON glosowania;
CREATE POLICY "glosowania_select_anon"
  ON glosowania FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "glosy_poslow_select_anon" ON glosy_poslow;
CREATE POLICY "glosy_poslow_select_anon"
  ON glosy_poslow FOR SELECT TO anon USING (true);

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

-- Sonda obywatelska działa tak samo: zapis i odczyt wyłącznie przez
-- /api/glosy-obywateli, więc anon nie dostaje żadnej polityki. Gdyby dostał
-- SELECT, każdy mógłby odczytać, jak zagłosował konkretny user_id.
DROP POLICY IF EXISTS "glosy_obywateli_select_anon" ON glosy_obywateli;
DROP POLICY IF EXISTS "glosy_obywateli_insert_anon" ON glosy_obywateli;
DROP POLICY IF EXISTS "glosy_obywateli_update_anon" ON glosy_obywateli;
DROP POLICY IF EXISTS "glosy_obywateli_delete_anon" ON glosy_obywateli;

-- Profile: każdy może czytać publiczne karty obywateli, ale zapis tylko
-- właścicielowi. Ukrywanie pól (pokaz_*) egzekwuje warstwa aplikacji —
-- Postgres nie chowa pojedynczych kolumn per wiersz.
DROP POLICY IF EXISTS "profile_select_public" ON profile;
CREATE POLICY "profile_select_public"
  ON profile FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profile_insert_own" ON profile;
CREATE POLICY "profile_insert_own"
  ON profile FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profile_update_own" ON profile;
CREATE POLICY "profile_update_own"
  ON profile FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profile_delete_own" ON profile;
CREATE POLICY "profile_delete_own"
  ON profile FOR DELETE TO authenticated
  USING (id = auth.uid());

GRANT SELECT ON TABLE profile TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE profile TO authenticated;

-- Bucket na awatary obywateli. Publiczny odczyt, bo avatar_url trafia
-- na karty profilu; zapis tylko własnych plików nazwy {userId}-{timestamp}.*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '-%'
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '-%'
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '-%'
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '-%'
  );
