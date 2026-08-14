# SEJM ON

Obywatelska aplikacja mobile-first do śledzenia prac Sejmu RP — ustaw, obrad, głosowań i aktywności posłów.

Na tym etapie repozytorium zawiera wyłącznie **warstwę interfejsu (mockup)**: brak bazy danych, brak API, dane są zaszyte w komponentach.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, bez katalogu `src`)
- TypeScript
- Tailwind CSS 4 (konfiguracja motywu w `app/globals.css` przez `@theme`)
- [lucide-react](https://lucide.dev) — ikony

## Wymagania

- Node.js **20.9+** (Next 16 nie uruchomi się na starszych wersjach)
- npm

Jeśli nie masz Node.js, zainstaluj go poleceniem:

```powershell
winget install OpenJS.NodeJS.LTS
```

a następnie otwórz nowe okno terminala (żeby odświeżyć `PATH`).

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

## Struktura

```
app/
  layout.tsx        # powłoka PWA: wyśrodkowany kontener max-w-md + BottomNav
  globals.css       # paleta kolorów i motyw Tailwind
  page.tsx          # ekran startowy (logo, kafelki, sekcja "Nowości")
  kalendarz/        # ekrany-zaślepki dla pozostałych zakładek
  obrady/
  glosowania/
  wiecej/
  ustawy/
  poslowie/
components/
  bottom-nav.tsx        # stały dolny pasek nawigacji
  placeholder-screen.tsx
```

## Paleta

| Token                 | Wartość   | Zastosowanie                       |
| --------------------- | --------- | ---------------------------------- |
| `navy-950`            | `#061027` | tło poza kontenerem (desktop)      |
| `navy-900`            | `#0B1B3D` | główne tło aplikacji               |
| `navy-800` / `700`    | `#12274F` / `#1B3565` | powierzchnie i awatary |
| `sejm-green`          | `#17A24A` | akcent logo, aktywna zakładka      |
| `sejm-green-light`    | `#2FC46A` | linki i statusy                    |

Layout jest mobile-first: na telefonie zajmuje pełny ekran, na desktopie renderuje się jako wyśrodkowany pionowy kontener o szerokości `max-w-md`.
