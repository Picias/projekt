/**
 * Warstwa "tłumacząca prawo na ludzki język".
 *
 * Docelowo teksty mają pochodzić z modelu językowego. Do czasu podłączenia
 * modelu generujemy deterministyczne podsumowanie dopasowane tematycznie do
 * tytułu druku, żeby interfejs prezentował realistyczne treści.
 * UI oznacza te sekcje jako wersję demonstracyjną.
 */

export type HumanSummary = {
  opis_ludzki: string;
  kogo_dotyczy: string;
  co_zmienia: string;
  koszty_i_finansowanie: string;
};

type Topic = {
  key: string;
  keywords: string[];
  dziedzina: string;
  summary: (author: string) => HumanSummary;
};

const TOPICS: Topic[] = [
  {
    key: "podatki",
    keywords: ["podatk", "pit", "cit", "vat", "akcyz", "danin", "opłat", "skarbow"],
    dziedzina: "podatki i finanse obywateli",
    summary: (author) => ({
      opis_ludzki: `Projekt zmienia zasady rozliczeń podatkowych. ${author} chce uporządkować przepisy, które dziś budzą najwięcej wątpliwości przy wypełnianiu deklaracji, i doprecyzować, kto i w jakiej wysokości płaci daninę. Dla większości osób oznacza to inną kwotę do zapłaty lub zwrotu w rocznym rozliczeniu.`,
      kogo_dotyczy: `Przede wszystkim podatników rozliczających się indywidualnie oraz przedsiębiorców prowadzących jednoosobową działalność. Zmiany odczują też biura rachunkowe i działy kadr, które muszą przeliczyć zaliczki. Osoby o najniższych dochodach zwykle korzystają na takich korektach najbardziej.`,
      co_zmienia: `• Nowe progi i stawki, według których liczy się należny podatek.\n• Zmienione terminy oraz zakres obowiązkowych deklaracji.\n• Doprecyzowanie ulg i zwolnień, żeby ograniczyć spory z urzędem skarbowym.`,
      koszty_i_finansowanie: `Skutki dla budżetu państwa zależą od skali obniżek — resort finansów szacuje je w ocenie wpływu załączonej do druku. Ubytek dochodów jest zwykle rekompensowany uszczelnieniem poboru podatku, a nie nowymi daninami. Samorządy mogą stracić część udziału w podatku, dlatego projekt przewiduje mechanizm wyrównawczy.`,
    }),
  },
  {
    key: "zdrowie",
    keywords: ["zdrow", "pacjent", "lecz", "szpital", "lek", "refundac", "medyczn", "ratownic"],
    dziedzina: "ochrona zdrowia",
    summary: (author) => ({
      opis_ludzki: `Projekt dotyczy organizacji opieki zdrowotnej. ${author} chce skrócić drogę pacjenta do świadczenia i jaśniej opisać, za co odpowiada placówka, a za co płatnik. W praktyce chodzi o to, by na wizytę lub zabieg czekać krócej i wiedzieć, co przysługuje bezpłatnie.`,
      kogo_dotyczy: `Pacjentów korzystających z publicznej opieki zdrowotnej, w szczególności osób z chorobami przewlekłymi i seniorów. Dotyczy też lekarzy, pielęgniarek i ratowników, którym zmieniają się obowiązki sprawozdawcze. Placówki medyczne muszą dostosować organizację pracy i systemy rozliczeń.`,
      co_zmienia: `• Inne zasady kwalifikowania pacjentów do świadczeń i kolejek.\n• Rozszerzony lub przebudowany katalog usług finansowanych ze środków publicznych.\n• Nowe wymogi wobec placówek — sprawozdawczość, standardy i kontrola jakości.`,
      koszty_i_finansowanie: `Wydatki pokrywane są ze środków Narodowego Funduszu Zdrowia oraz z budżetu państwa w części przeznaczonej na zdrowie. Skala kosztów rośnie stopniowo, bo przepisy wchodzą w życie etapami. Projekt nie przewiduje dodatkowej składki po stronie pacjenta.`,
    }),
  },
  {
    key: "edukacja",
    keywords: ["oświat", "szkol", "edukac", "ucze", "student", "nauczyciel", "wychowa", "uczeln"],
    dziedzina: "edukacja",
    summary: (author) => ({
      opis_ludzki: `Projekt zmienia zasady funkcjonowania szkół i uczelni. ${author} porządkuje kwestie programu, organizacji zajęć oraz obowiązków po stronie dyrektorów i nauczycieli. Dla uczniów i rodziców najbardziej widoczna będzie zmiana w tym, jak wygląda tygodniowy plan i sposób oceniania.`,
      kogo_dotyczy: `Uczniów, ich rodziców oraz nauczycieli i dyrektorów placówek. Część przepisów obejmuje także studentów i pracowników uczelni. Organy prowadzące szkoły, czyli głównie gminy, muszą dopasować budżety i kadry.`,
      co_zmienia: `• Zmodyfikowany zakres obowiązkowych zajęć i wymagań programowych.\n• Nowe reguły oceniania, egzaminów lub rekrutacji.\n• Inne zasady zatrudniania i wynagradzania nauczycieli.`,
      koszty_i_finansowanie: `Główne źródło to część oświatowa subwencji ogólnej przekazywanej samorządom. Projekt przewiduje okres przejściowy, żeby gminy mogły rozłożyć wydatki na kilka lat budżetowych. Dodatkowe koszty po stronie rodziców nie są zakładane.`,
    }),
  },
  {
    key: "praca",
    keywords: ["prac", "wynagrodz", "zatrudni", "emeryt", "renta", "zasiłek", "świadczen", "urlop", "związk"],
    dziedzina: "praca i świadczenia socjalne",
    summary: (author) => ({
      opis_ludzki: `Projekt dotyczy warunków zatrudnienia i wypłacanych świadczeń. ${author} chce jaśniej rozdzielić uprawnienia pracownika od obowiązków pracodawcy oraz zaktualizować zasady przyznawania wsparcia. Efektem będzie inna wysokość albo inny sposób naliczania wypłat.`,
      kogo_dotyczy: `Osób zatrudnionych na umowę o pracę oraz pracodawców, którzy muszą zaktualizować regulaminy. Dotyczy też świadczeniobiorców — emerytów, rencistów i rodzin korzystających ze wsparcia. Zmiany obejmą działy kadr i płac w firmach każdej wielkości.`,
      co_zmienia: `• Nowe zasady ustalania wysokości wynagrodzeń lub świadczeń.\n• Zmienione uprawnienia do urlopów, przerw i ochrony zatrudnienia.\n• Inne obowiązki dokumentacyjne i sprawozdawcze pracodawcy.`,
      koszty_i_finansowanie: `Koszty rozkładają się między budżet państwa, Fundusz Ubezpieczeń Społecznych i pracodawców. Wypłaty świadczeń finansuje sektor publiczny, natomiast podwyżki po stronie firm obciążają ich koszty pracy. Projekt zwykle zakłada stopniowe wejście w życie, by ograniczyć jednorazowe obciążenie.`,
    }),
  },
  {
    key: "mieszkania",
    keywords: ["mieszkan", "lokator", "najem", "budown", "nieruchomo", "planowani przestrzenn", "grunt"],
    dziedzina: "mieszkalnictwo i budownictwo",
    summary: (author) => ({
      opis_ludzki: `Projekt dotyczy rynku mieszkaniowego i procesu inwestycyjnego. ${author} chce skrócić procedury albo zmienić zasady ochrony osób wynajmujących. W praktyce może to wpłynąć na dostępność mieszkań i czas potrzebny na uzyskanie pozwoleń.`,
      kogo_dotyczy: `Najemców i właścicieli mieszkań, a także osób planujących budowę domu. Dotyczy również deweloperów, spółdzielni i wspólnot mieszkaniowych. Urzędy gmin obsługujące wnioski budowlane muszą dostosować procedury.`,
      co_zmienia: `• Zmienione terminy i wymogi formalne w procesie inwestycyjnym.\n• Nowe reguły umów najmu i ochrony lokatorów.\n• Inne zasady gospodarowania gruntami przez samorządy.`,
      koszty_i_finansowanie: `Programy wsparcia mieszkaniowego finansowane są z budżetu państwa oraz funduszy celowych, w tym środków Banku Gospodarstwa Krajowego. Część kosztów administracyjnych ponoszą gminy obsługujące wnioski. Dla obywateli projekt zwykle nie wprowadza nowych opłat.`,
    }),
  },
  {
    key: "energia",
    keywords: ["energ", "prąd", "gaz", "ciepł", "klimat", "emisj", "odnawialn", "paliw", "węgl"],
    dziedzina: "energetyka i klimat",
    summary: (author) => ({
      opis_ludzki: `Projekt reguluje rynek energii i ceny nośników. ${author} chce ustabilizować rachunki odbiorców albo przyspieszyć inwestycje w nowe źródła wytwarzania. Dla gospodarstw domowych kluczowa będzie zmiana w sposobie ustalania taryf.`,
      kogo_dotyczy: `Wszystkich odbiorców energii elektrycznej, gazu i ciepła — od gospodarstw domowych po zakłady produkcyjne. Dotyczy też spółek energetycznych i operatorów sieci. Odbiorcy wrażliwi mogą zostać objęci osobnym mechanizmem ochronnym.`,
      co_zmienia: `• Nowe zasady wyliczania taryf i rozliczania odbiorców.\n• Zmienione warunki przyłączania instalacji do sieci.\n• Inne obowiązki sprawozdawcze i limity emisyjne dla wytwórców.`,
      koszty_i_finansowanie: `Mechanizmy osłonowe finansuje budżet państwa oraz fundusze celowe zasilane wpływami z systemu handlu uprawnieniami do emisji. Część kosztów przenoszona jest na taryfy, dlatego projekt zawiera limity wzrostu cen. Inwestycje sieciowe pokrywają operatorzy z własnych środków i funduszy europejskich.`,
    }),
  },
  {
    key: "transport",
    keywords: ["transport", "drog", "kolej", "pojazd", "kierow", "ruchu", "lotnic", "żeglug"],
    dziedzina: "transport i komunikacja",
    summary: (author) => ({
      opis_ludzki: `Projekt zmienia przepisy dotyczące transportu i poruszania się po drogach. ${author} chce poprawić bezpieczeństwo albo uporządkować zasady wykonywania przewozów. Kierowcy odczują to głównie w obowiązkach kontrolnych i wysokości kar.`,
      kogo_dotyczy: `Kierowców i właścicieli pojazdów, a także firm transportowych i przewoźników. Dotyczy również pasażerów komunikacji zbiorowej oraz zarządców dróg. Zmiany obejmą stacje kontroli pojazdów i organy wydające uprawnienia.`,
      co_zmienia: `• Zmodyfikowane zasady ruchu drogowego i katalog kar.\n• Nowe wymogi techniczne oraz obowiązki rejestracyjne.\n• Inne reguły organizowania i finansowania przewozów publicznych.`,
      koszty_i_finansowanie: `Inwestycje drogowe i kolejowe finansuje Krajowy Fundusz Drogowy oraz środki europejskie, uzupełniane budżetem państwa. Koszty organizacji przewozów lokalnych spoczywają na samorządach, którym projekt zwykle przewiduje dofinansowanie. Wpływy z kar zasilają fundusze celowe związane z bezpieczeństwem.`,
    }),
  },
  {
    key: "rolnictwo",
    keywords: ["roln", " wsi", "żywno", "gospodarstw", "hodowl", "weterynar", "leśn"],
    dziedzina: "rolnictwo i obszary wiejskie",
    summary: (author) => ({
      opis_ludzki: `Projekt dotyczy rolnictwa i rynku żywności. ${author} chce uporządkować zasady wsparcia gospodarstw albo wymagania jakościowe wobec produktów. Dla konsumentów zmiany będą widoczne głównie w oznaczeniach na etykietach.`,
      kogo_dotyczy: `Rolników i właścicieli gospodarstw, zwłaszcza mniejszych, którzy korzystają z dopłat. Dotyczy też przetwórców żywności i sieci handlowych. Konsumenci odczują zmiany w informacjach o pochodzeniu produktów.`,
      co_zmienia: `• Nowe zasady przyznawania dopłat i pomocy dla gospodarstw.\n• Zmienione wymogi jakościowe oraz obowiązki znakowania żywności.\n• Inne reguły obrotu ziemią rolną i kontroli weterynaryjnej.`,
      koszty_i_finansowanie: `Główne źródło to środki Wspólnej Polityki Rolnej Unii Europejskiej wraz z krajowym współfinansowaniem. Wypłaty obsługuje Agencja Restrukturyzacji i Modernizacji Rolnictwa. Dodatkowe zadania kontrolne finansuje budżet państwa.`,
    }),
  },
  {
    key: "samorzad",
    keywords: ["samorząd", "gmin", "powiat", "wojewod", "sołec", "lokaln"],
    dziedzina: "samorząd terytorialny",
    summary: (author) => ({
      opis_ludzki: `Projekt zmienia zakres zadań i finansów samorządów. ${author} chce inaczej rozdzielić odpowiedzialność między państwo a gminy oraz doprecyzować źródła dochodów lokalnych. Mieszkańcy odczują to w jakości usług świadczonych przez urząd.`,
      kogo_dotyczy: `Gmin, powiatów i województw oraz ich pracowników. Dotyczy również mieszkańców korzystających z usług lokalnych — od transportu po opiekę społeczną. Radni zyskują lub tracą część kompetencji decyzyjnych.`,
      co_zmienia: `• Przesunięcie zadań i kompetencji między poziomami administracji.\n• Zmienione zasady naliczania dochodów i subwencji.\n• Nowe wymogi konsultacji i jawności decyzji lokalnych.`,
      koszty_i_finansowanie: `Zadania przekazane samorządom muszą mieć zapewnione finansowanie w formie subwencji lub dotacji celowej. Projekt określa mechanizm wyrównawczy dla gmin o niższych dochodach własnych. Skutki dla budżetu państwa rozłożone są na kilka lat.`,
    }),
  },
  {
    key: "sprawiedliwosc",
    keywords: ["kodeks", "karn", "sąd", "prokurat", "postępowani", "cywiln", "wykroczeni", "więzien"],
    dziedzina: "sądy i prawo karne",
    summary: (author) => ({
      opis_ludzki: `Projekt zmienia procedury sądowe lub katalog kar. ${author} chce przyspieszyć rozpoznawanie spraw albo dostosować sankcje do skali czynów. Dla uczestników postępowań najważniejsze będą nowe terminy i wymogi formalne.`,
      kogo_dotyczy: `Osób biorących udział w postępowaniach — stron, świadków i pokrzywdzonych. Dotyczy sędziów, prokuratorów, adwokatów i radców prawnych. Zmiany obejmą także służby prowadzące czynności dochodzeniowe.`,
      co_zmienia: `• Nowe terminy procesowe i zasady doręczeń.\n• Zmieniony katalog czynów zabronionych oraz wysokość kar.\n• Inne uprawnienia stron i organów w toku postępowania.`,
      koszty_i_finansowanie: `Wydatki pokrywa budżet państwa w części dotyczącej sądownictwa i prokuratury. Dodatkowe koszty wynikają głównie z informatyzacji akt i obsługi większej liczby czynności. Wpływy z grzywien częściowo równoważą te nakłady.`,
    }),
  },
  {
    key: "cyfryzacja",
    keywords: ["cyfr", "informatyz", "dane osobow", "internet", "telekomunik", "sztucznej inteligencji", "elektronicz"],
    dziedzina: "cyfryzacja i dane",
    summary: (author) => ({
      opis_ludzki: `Projekt dotyczy usług cyfrowych i przetwarzania danych. ${author} chce przenieść kolejne formalności do internetu oraz jaśniej określić, kto odpowiada za bezpieczeństwo informacji. Dla obywatela oznacza to mniej wizyt w urzędzie.`,
      kogo_dotyczy: `Wszystkich korzystających z e-usług publicznych, w tym profilu zaufanego i aplikacji mObywatel. Dotyczy administratorów danych w firmach i urzędach. Operatorzy telekomunikacyjni oraz dostawcy usług cyfrowych zyskują nowe obowiązki.`,
      co_zmienia: `• Nowe kanały elektroniczne dla wniosków i doręczeń.\n• Zmienione wymogi bezpieczeństwa i zgłaszania incydentów.\n• Inne zasady udostępniania danych między instytucjami.`,
      koszty_i_finansowanie: `Wdrożenia finansuje budżet państwa oraz Fundusz Cyfryzacji, wspierane środkami europejskimi. Koszty dostosowania systemów ponoszą także podmioty prywatne objęte nowymi wymogami. Oszczędności mają pojawić się po stronie administracji dzięki ograniczeniu obiegu papierowego.`,
    }),
  },
  {
    key: "bezpieczenstwo",
    keywords: ["obron", "wojsk", "policj", "bezpieczeń", "granic", "straż", "kryzysow", "cudzoziemc"],
    dziedzina: "bezpieczeństwo i obronność",
    summary: (author) => ({
      opis_ludzki: `Projekt dotyczy bezpieczeństwa państwa i działania służb. ${author} chce doprecyzować uprawnienia funkcjonariuszy oraz zasady reagowania w sytuacjach kryzysowych. Dla obywateli najistotniejsze są nowe procedury kontrolne.`,
      kogo_dotyczy: `Funkcjonariuszy służb i żołnierzy oraz ich rodzin w zakresie świadczeń. Dotyczy również obywateli objętych obowiązkami wynikającymi z przepisów obronnych. Samorządy uczestniczą w planowaniu działań kryzysowych.`,
      co_zmienia: `• Nowe uprawnienia i obowiązki służb w czynnościach kontrolnych.\n• Zmienione zasady rekrutacji, szkoleń i świadczeń dla funkcjonariuszy.\n• Inne procedury reagowania w stanach nadzwyczajnych.`,
      koszty_i_finansowanie: `Wydatki pochodzą z budżetu państwa w części dotyczącej obrony narodowej i spraw wewnętrznych oraz z Funduszu Wsparcia Sił Zbrojnych. Nakłady rosną etapami wraz z realizacją zakupów sprzętowych. Samorządy otrzymują dotacje celowe na zadania kryzysowe.`,
    }),
  },
  {
    key: "budzet",
    keywords: ["budżet", "finansów publiczn", "dług", "wieloletni plan", "rachunkow", "sprawozdawcz"],
    dziedzina: "finanse publiczne",
    summary: (author) => ({
      opis_ludzki: `Projekt dotyczy planowania i rozliczania środków publicznych. ${author} porządkuje zasady wydatkowania oraz sprawozdawczości instytucji państwowych. Bezpośrednich skutków dla domowego budżetu zwykle nie ma, ale zmiany wpływają na finansowanie usług publicznych.`,
      kogo_dotyczy: `Jednostek sektora finansów publicznych, w tym ministerstw, agencji i samorządów. Dotyczy również księgowych i audytorów rozliczających środki publiczne. Obywatele odczują to pośrednio, przez zakres finansowanych zadań.`,
      co_zmienia: `• Nowe reguły planowania i limitowania wydatków.\n• Zmieniony zakres sprawozdań oraz terminy ich składania.\n• Inne zasady nadzoru nad zadłużeniem jednostek publicznych.`,
      koszty_i_finansowanie: `Projekt sam w sobie nie generuje dużych nakładów — porządkuje sposób wydawania już zaplanowanych środków. Koszty dotyczą głównie dostosowania systemów księgowych. Efektem ma być lepsza kontrola nad deficytem i długiem publicznym.`,
    }),
  },
];

const DEFAULT_SUMMARY = (author: string): HumanSummary => ({
  opis_ludzki: `To projekt zmieniający obowiązujące przepisy. ${author} wskazuje, że dotychczasowe regulacje wymagają aktualizacji, i proponuje nowe brzmienie wybranych artykułów. Skutki dla obywateli zależą od tego, które przepisy szczegółowe zostaną ostatecznie przyjęte.`,
  kogo_dotyczy: `Zakres podmiotowy wynika bezpośrednio z nowelizowanej ustawy — obejmuje osoby i instytucje już objęte tymi przepisami. Nowych grup adresatów projekt nie wprowadza. Najmocniej zmiany odczują podmioty, które prowadzą sprawozdawczość na podstawie tej ustawy.`,
  co_zmienia: `• Zmienione brzmienie wybranych artykułów ustawy podstawowej.\n• Doprecyzowanie definicji, które budziły wątpliwości interpretacyjne.\n• Przepisy przejściowe określające sposób stosowania nowych reguł.`,
  koszty_i_finansowanie: `Uzasadnienie projektu wskazuje, że zmiany mieszczą się w dotychczasowych limitach wydatków właściwego resortu. Nowe źródła finansowania nie są tworzone. Ewentualne koszty administracyjne pokrywa budżet państwa w ramach części przypisanej wnioskodawcy.`,
});

function normalize(text: string): string {
  return text.toLowerCase();
}

function detectTopic(title: string): Topic | null {
  const normalized = normalize(title);

  for (const topic of TOPICS) {
    if (topic.keywords.some((keyword) => normalized.includes(keyword))) {
      return topic;
    }
  }

  return null;
}

function buildAuthorPhrase(autor: string | null): string {
  if (!autor) {
    return "Wnioskodawca";
  }

  switch (autor) {
    case "Rada Ministrów":
      return "Rząd";
    case "Grupa posłów":
      return "Grupa posłów";
    case "Inicjatywa obywatelska":
      return "Komitet obywatelski";
    case "Senat":
      return "Senat";
    case "Prezydent RP":
      return "Prezydent";
    case "Komisja sejmowa":
      return "Komisja sejmowa";
    default:
      return autor;
  }
}

export function buildHumanSummary(options: {
  title: string;
  autor: string | null;
}): HumanSummary {
  const authorPhrase = buildAuthorPhrase(options.autor);
  const topic = detectTopic(options.title);

  return topic ? topic.summary(authorPhrase) : DEFAULT_SUMMARY(authorPhrase);
}

export function detectDziedzina(title: string): string {
  return detectTopic(title)?.dziedzina ?? "legislacja ogólna";
}
