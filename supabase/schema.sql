-- Schemat danych analitycznych posłów (SEJM ON, kadencja X)
-- Uruchom w Supabase SQL Editor po tabeli poslowie.

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

-- RLS: odczyt publiczny, zapis dla anon (jak poslowie — dostosuj do swojej polityki)
ALTER TABLE posel_frekwencja ENABLE ROW LEVEL SECURITY;
ALTER TABLE posel_glosowania ENABLE ROW LEVEL SECURITY;
ALTER TABLE interpelacje ENABLE ROW LEVEL SECURITY;
ALTER TABLE frekwencja_agregaty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posel_frekwencja_select_anon"
  ON posel_frekwencja FOR SELECT TO anon USING (true);

CREATE POLICY "posel_frekwencja_insert_anon"
  ON posel_frekwencja FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "posel_frekwencja_update_anon"
  ON posel_frekwencja FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "posel_glosowania_select_anon"
  ON posel_glosowania FOR SELECT TO anon USING (true);

CREATE POLICY "posel_glosowania_insert_anon"
  ON posel_glosowania FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "posel_glosowania_update_anon"
  ON posel_glosowania FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "posel_glosowania_delete_anon"
  ON posel_glosowania FOR DELETE TO anon USING (true);

CREATE POLICY "interpelacje_select_anon"
  ON interpelacje FOR SELECT TO anon USING (true);

CREATE POLICY "interpelacje_insert_anon"
  ON interpelacje FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "interpelacje_update_anon"
  ON interpelacje FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "frekwencja_agregaty_select_anon"
  ON frekwencja_agregaty FOR SELECT TO anon USING (true);

CREATE POLICY "frekwencja_agregaty_insert_anon"
  ON frekwencja_agregaty FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "frekwencja_agregaty_update_anon"
  ON frekwencja_agregaty FOR UPDATE TO anon USING (true) WITH CHECK (true);
