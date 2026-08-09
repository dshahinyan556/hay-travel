# Hay Travel — документация

Сайт турагентства Hay Travel + админ-панель для управления турами/экскурсиями.

## Стек и структура
- **Frontend** (`Hay Travel/Frontend`): Vite + React 19 + TypeScript + Tailwind v4 + React Router v8 (data mode). Собирается в статику, деплой на Netlify.
- **Backend** (`Hay Travel/Backend`, решение `ATTours.slnx`): .NET, слоистая архитектура (ClientAPI → Service → ContextRepository → DataLayer + Common/Helper). БД SQL Server (`ATTours`), EF Core.
- API base route: `api/Tour`. Frontend читает базовый URL только из `VITE_API_BASE_URL` (в `Frontend/.env`).

## Как поднять
Ярлыки в `.claude/launch.json`:
- `hay-travel-frontend` → Vite на :5173.
- `hay-travel-backend` → API на :5253 (порт передаётся флагом `--urls`, совпадает с дефолтным профилем `launchSettings.json`). `Frontend/.env` (`VITE_API_BASE_URL`) и `start-servers.bat` должны указывать тот же порт — рассинхрон (2026-08-09: `start-servers.bat` был на 5254) ломает локальный запуск молча, фронт просто не достучится до бэка.

Backend требует `ASPNETCORE_ENVIRONMENT=Development` (строка подключения к БД `ATTours` только в `ATTours.ClientAPI/appsettings.Development.json`). Админка: `http://localhost:5173/admin`.

EF-миграции:
```
cd Hay Travel/Backend
ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add <Name> --project ATTours.DataLayer --startup-project ATTours.ClientAPI
ASPNETCORE_ENVIRONMENT=Development dotnet ef database update --project ATTours.DataLayer --startup-project ATTours.ClientAPI
```

## Оглавление
- [client-site.md](client-site.md) — публичный сайт: дизайн-токены (тёмный люкс), карта марзов, правила карточек.
- [admin-panel.md](admin-panel.md) — админ-панель: роуты, каркас, сайдбар/мобильное меню, дашборд, страница «Продукты».
- [product-model.md](product-model.md) — как устроен продукт: тур vs экскурсия, форма, цена, валидации, архив, переводы.
- [backend-api.md](backend-api.md) — контракт бэкенда: енумы, эндпоинты, ключевые правила.
- [CHANGELOG.md](CHANGELOG.md) — история изменений.

## Правило документации
**После каждого добавления/изменения фичи — обновлять соответствующий doc-файл и добавлять запись в [CHANGELOG.md](CHANGELOG.md).** Документы модульные (по фичам): правишь то, что относится к изменению, а не всё сразу.
