# Контракт бэкенда (`api/Tour`)

Слоистая архитектура: контроллер (`TourController`) → сервисы (`ATTours.Service/Services/*`) → репозитории → EF Core. Контроллер использует `new XxxService()` (не DI — текущий стиль проекта).

## Енумы (сериализуются ЧИСЛАМИ, не строками)
- `TourType`: Tour=1, Excursion=2.
- `LanguageCode`: Russian=1, English=2.
- `TourTranslationType`: Title=1, ShortDescription=2, Description=3, Duration=4.
- `TourDayTranslationType`: Title=1, ShortDescription=2, Description=3, Duration=4.
- `ExpenseTranslationType.Description = 0` (на бэке опечатка `Desciption`).
- Точки маршрута / орг.детали / ограничения — отдельные упорядоченные сущности (`SortOrder`), текст как translation с `type=0`.

## Эндпоинты
| Метод | Route | Тело / параметры | Возврат |
| --- | --- | --- | --- |
| GET | `InitTour?type=` | — | `TourCreateModel` (пустой скелет) |
| POST | `CreateTour` | `TourCreateModel` | `TourCreatedModel {Id}` |
| GET | `GetAll` | — | `TourInfoModel[]` (только `!IsArchived`) |
| GET | `GetArchived` | — | `TourInfoModel[]` (только `IsArchived`) |
| GET | `InitUpdate?id=` | — | `TourInfoModel` (полный граф) |
| PUT | `UpdateTour` | `TourInfoModel` | `TourInfoModel` (перечитанный) |
| PATCH | `SetActive` | `{Id, IsActive}` | — |
| PATCH | `SetArchived` | `{Id, IsArchived}` | — |
| DELETE | `DeleteTour?id=` | — | — (каскадное удаление графа) |
| GET | `GetToursClient?languageCode=` | — | `TourInfoModel[]` (одна локаль) |
| GET | `GetTourInfo?id=&languageCode=` | — | `TourInfoModel` (одна локаль) |

## Ключевые правила
- **Модели**: `*CreateModel` — без Id (id-less); `*InfoModel` — с Id. `TourInfoModel` отдаёт `IsActive`, `IsArchived`, `TotalPrice`.
- **UpdateTour** реконсилит весь граф **по Id**: `Id==0` → добавить, совпадающий Id → обновить, отсутствующий в payload Id → удалить. Чужой Id → 400. `IsActive`/`IsArchived`/`TotalPrice` в UpdateTour игнорируются (управляются отдельно / считаются на бэке).
- **Дни** подключены к туру через join-таблицу `TourDetail` (без своего Id) — Delete/Update удаляют/реконсилят `TourDay` явно.
- **TotalPrice** — compute-on-write: Σ(TourDay.Price) при create/update.
- **Валидация** (`TourValidationService`, на create и update): экскурсия = ровно 1 день, тур ≥ 2; цена дня ≥ 0; ≥1 точка маршрута в каждом дне. Смена типа запрещена (`TourUpdateService`).

## Сервисы (карта)
`TourInitializationService` (init) · `TourCreationService` (create) · `TourInfo` (read/GetAll/InitUpdate) · `TourUpdateService` (update-reconcile) · `TourActivationService` (SetActive) · `TourArchivalService` (SetArchived) · `TourDeletionService` (hard delete) · `TourValidationService` (валидация).

## Миграции
Актуальные (в `ATTours.DataLayer/Migrations`): `InitialCreate`, `AddRoutePoint`, `AddOrganizationalDetailAndRestriction`, `ChangeTourDayChildrenToCascade`, `AddTourIsArchived`.
