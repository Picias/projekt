export type OkregOption = {
  numer: number;
  siedziba: string;
  liczbaPoslow: number;
};

export type PoselOkregu = {
  id: number;
  imie_nazwisko: string;
  partia: string | null;
  zdjecie_url: string | null;
};

export type MojOkregResponse = {
  okregi: OkregOption[];
  poslowie: PoselOkregu[];
};
