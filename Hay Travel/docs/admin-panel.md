# Админ-панель

Самодостаточный инструмент под роутом `/admin` (свой каркас, без публичного Header/Footer). Авторизации пока нет, но точка врезки заложена (`adminRootLoader`).

## Роуты (`src/app/router.tsx`)
| Путь | Экран |
| --- | --- |
| `/admin` | Дашборд (обзор) |
| `/admin/products` | Продукты (управление) |
| `/admin/tours/new` | Создание продукта |
| `/admin/tours/:id/edit` | Редактирование продукта |

Весь admin код-сплитом за одним lazy-импортом (включая `AdminErrorBoundary` как `ErrorBoundary`, не статичный `errorElement` — иначе весь admin утянется в main-бандл).

## Структура фичи (`src/features/admin/`)
```
layout/     AdminLayout, AdminSidebar, AdminErrorBoundary, adminRootLoader
dashboard/  DashboardPage (+loader), components/StatCards
products/   ProductsPage (+loader), components/{ProductsToolbar,ProductsTable}, lib/filterProducts
tour-form/  форма создания/редактирования (см. product-model.md)
api/        adminTours.ts — по функции на эндпоинт
lib/        enums.ts, tourMapper.ts (wire ↔ view-model)
types/      form.ts (view-model формы)
ui/         TourTableParts.tsx — общие TourThumb/TypeBadge/tourTitleRu
```
Единственная точка импорта извне — barrel `index.ts`.

## Каркас и адаптивность (`AdminLayout` + `AdminSidebar`)
- **Десктоп (`md+`)**: слева фиксированный тёмный рельс `w-60` (`AdminSidebar`), справа рабочая область.
- **Мобилка**: тонкий топ-бар с кнопкой-гамбургером (3 полоски) → выдвижной drawer-оверлей с той же навигацией. Закрывается по backdrop-клику, по клику на пункт и при смене роута (`location.key`); фон заблокирован от прокрутки.
- `AdminSidebar` переиспользуемый (проп `onNavigate`), рендерится и в рельсе, и в drawer.
- Навигация плоская: **Дашборд** (`/admin`) и **Продукты** (`/admin/products`), без групп-заголовков.

> ⚠️ Анимация сдвига drawer сделана через inline `style={{transform:…}}`, а не Tailwind `translate-x-*` — в Tailwind v4 `translate-x-*` пишет CSS-свойство `translate`, и связка с `transition-transform` залипала. См. CHANGELOG.

## Дашборд (`/admin`)
Только обзор (переделается позже): карточки-счётчики (`StatCards`: всего/туров/экскурсий/без EN-перевода) + короткий список «Недавние продукты» (топ-5 по id, read-only ссылки на редактирование, «Все продукты →»). **Кнопки создания и управления тут нет** — они на странице «Продукты».

## Продукты (`/admin/products`)
Полноценное управление. Loader грузит активные и архивные списки параллельно (`getAllTours` + `getArchivedTours`).
- **Тулбар** (`ProductsToolbar`): переключатель **Активные | Архив** со счётчиками, поиск по заголовку (RU/EN), фильтры по типу и по публикации (последний — только в «Активных»). Фильтрация чистая — `lib/filterProducts.ts`.
- **Таблица** (`ProductsTable`): клик по строке (или по заголовку) открывает редактирование. Колонки: фото, заголовок RU, тип, дней, публикация (только активные), действия.
- **Действия**: активные — тумблер публикации + «🗄 В архив»; архив — «↩ Восстановить» + «Удалить» (окончательно, с модалкой подтверждения).
- Кнопка «Создать продукт» — в шапке страницы.
- Все мутации → соответствующий вызов API + `useRevalidator` (списки и счётчики обновляются сами).

Архив как модель — см. [product-model.md](product-model.md#архив).
