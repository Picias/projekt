# SejmON

W pełni funkcjonalna aplikacja full-stack typu PWA, monitorująca prace Sejmu RP w czasie rzeczywistym. Śledzi ustawy, obrady, głosowania i aktywność posłów — dane pochodzą z oficjalnego API Sejmu i są zapisywane w Supabase.

Interfejs jest mobile-first: na telefonie zajmuje pełny ekran, na desktopie renderuje się jako wyśrodkowany pionowy kontener.

## Stack technologiczny

- [Next.js 16](https://nextjs.org) (App Router)
- TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com) (PostgreSQL, Auth)
- [Lucide React](https://lucide.dev) — ikony

## Główne funkcjonalności

- **Automatyczna integracja z API Sejmu** — synchronizacja druków, posłów, posiedzeń, głosowań, wystąpień i interpelacji.
- **Autoryzacja i profile** — konta obywateli (Supabase Auth) z onboardingiem i personalizacją profilu.
- **Subskrypcje** — śledzenie konkretnych posłów i ustaw, z widokiem na stronie głównej i w listach.
- **Sonda obywatelska** — głos Za / Przeciw / Wstrzymuję się nad drukiem; jeden zalogowany użytkownik ma jeden głos na druk (zmiana zdania nadpisuje poprzedni).
- **Filtry analityczne** — m.in. identyfikacja ustaw w „Zamrażarce sejmowej” oraz wet prezydenckich, plus sortowanie i filtry listy druków.
- **Smart CRON** — aktualizacje w tle (głosowania i najnowsze druki w dni posiedzeń; pełniejsza synchronizacja ustaw według harmonogramu).

## Bezpieczeństwo

W Supabase działają polityki **Row Level Security (RLS)**. Chronią dane demograficzne profili oraz głosy i subskrypcje użytkowników: klient przeglądarki widzi tylko to, na co pozwalają polityki `anon` / `authenticated`. Zapis do bazy po stronie serwera (synchronizacja, CRON) idzie kluczem `service_role`, który omija RLS i **nigdy nie trafia do przeglądarki**.

Endpointy masowej synchronizacji wymagają `CRON_SECRET` albo sesji administratora (`ADMIN_EMAIL`).

## Wymagania

- Node.js **20.9+** (Next.js 16 nie uruchomi się na starszych wersjach)
- npm
- projekt Supabase z uruchomionym schematem z katalogu `supabase/`

Jeśli nie masz Node.js:

```powershell
winget install OpenJS.NodeJS.LTS
```

Po instalacji otwórz nowe okno terminala, żeby odświeżyć `PATH`.

## Konfiguracja i uruchomienie

Skopiuj `.env.example` do `.env.local` i uzupełnij wartości. **Nie commituj** plików `.env`, `.env.local` ani żadnych sekretów.

Wymagane zmienne środowiskowe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `ADMIN_EMAIL`
- `OPENAI_API_KEY`

```bash
npm install
npm run dev
```

Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).
