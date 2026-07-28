# Hay Travel Frontend — аудит фактического состояния + gap-лист

Дата: 2026-07-26. Только анализ, код не менялся.
Корень: `D:\Davo\Claude AI Agent\Hay Travel\Frontend`
Всё ниже — по факту чтения кода. Гипотезы помечены явно словом **ГИПОТЕЗА**.

Метрика: 7286 строк TS/TSX, 79 файлов в `src`.

---

## 1. Структура `src`: как разделены клиентский сайт и админка

### Верхний уровень
```
src/
  main.tsx              createRoot → <App/>
  index.css             ВСЕ дизайн-токены (Tailwind v4 @theme) + light/dark + keyframes
  app/
    App.tsx             только <RouterProvider>. Провайдеров НЕТ вообще
    router.tsx          единственное дерево роутов (публичное + /admin)
    layout/             RootLayout, Header, Footer, ThemeToggle, LanguageSwitch,
                        NotFoundPage, RouteErrorBoundary   ← публичный шелл
  features/
    home/               HomePage + HeroSection, FeaturedTours, Testimonials
    tours/              ToursPage (каталог), TourDetailPage, BookingCard,
                        TourGallery, TourItinerary, ToursFilterBar, hooks/useTourFilters
    regions/            RegionsPage, RegionExplorer, ArmeniaMap, RegionPanel
    auth/               AuthPage (UI-заглушка, ничего не отправляет)
    admin/              вся админка (см. ниже)
  shared/
    api/tours.ts        МОКИ публичного сайта (7 туров захардкожены)
    lib/http.ts         apiFetch → реальный бэкенд (VITE_API_BASE_URL)
    lib/format.ts       formatPrice/formatDuration/formatTourCount
    data/armeniaMarzes.ts  метаданные 11 марзов
    data/marzGeometry.ts   SVG-пути (37 КБ, отдельный модуль)
    types/tour.ts       публичная модель тура
    types/attours.ts    wire-DTO бэкенда (админка)
    ui/                 12 примитивов + TourCard + Chip + icons
    hooks/              пусто (.gitkeep)
```

### Разделение «сайт / админка» — три независимых механизма
1. **Роутинг**: два корневых объекта в `src/app/router.tsx`. `path:'/'` → `RootLayout`
   (Header/Footer/тёмная палитра), `path:'admin'` → `AdminLayout` (свой шелл, без Header/Footer).
2. **Код-сплит**: вся админка за одним `lazy(() => import('@/features/admin'))`, включая
   `AdminErrorBoundary` (специально как `ErrorBoundary`, а не `errorElement` — иначе admin
   утянется в main-бандл). Публичные страницы тоже lazy, каждая своя.
3. **Палитра**: публичный сайт — золото/вино/обсидиан по токенам `bg-page`/`text-ink`;
   админка — teal `brand-*` + `neutral-*` + захардкоженный `#0b1220` у сайдбара.
   Цвета намеренно НЕ на `body` (в `index.css` есть комментарий: когда были — кремовый текст
   протекал в `/admin` и становился невидимым).

### Слой API — их два, и они разные
| Модуль | Кто использует | Что делает |
|---|---|---|
| `shared/api/tours.ts` | публичный сайт | **МОКИ**. 7 туров в константе + `delay(260ms)`. Функции: `getTours`, `getFeaturedTours`, `getTourBySlug`, `getToursByRegion`, `countToursByRegion` |
| `features/admin/api/adminTours.ts` | админка | **реальный бэкенд** через `apiFetch`, 9 функций = 9 эндпоинтов `api/Tour/*` |

То есть публичный сайт **вообще не ходит на бэкенд** — ни одного вызова `apiFetch` вне админки.

### Состояние
- Глобального стора нет. Context нет. Zustand/Redux нет. В `App.tsx` прямо написано, что
  провайдеров нет за отсутствием межфичевого стейта.
- Данные страниц — через route `loader` + `useLoaderData` (React Router v8 data mode).
- Фильтры каталога — **в URL** (`useTourFilters` через `useSearchParams`), это осознанно
  (шарится ссылкой, переживает reload, работает back/forward).
- Форма тура — `useReducer` (`tourFormReducer`, 300 строк) + фасад `useTourForm`.
- Мутации в админке — вызов API + `useRevalidator()` (списки/счётчики обновляются сами).
- Тема — локальный `useState` **внутри самого компонента `ThemeToggle`** (важно, см. §4).

### Алиасы и границы
- `@/app`, `@/features`, `@/shared` объявлены и в `tsconfig.app.json`, и в `vite.config.ts`. Работают.
- Границы фич соблюдены **почти**: единственный кросс-фичевый импорт —
  `features/home/HomePage.tsx:4` импортирует `RegionExplorer` из `@/features/regions`
  (через barrel). Формально это нарушение правила «фичи не импортируют друг друга напрямую»,
  но это осознанный тизер карты на главной. Циклов нет.

### Расхождения кода с доками (drift)
- `docs/client-site.md:108` обещает `shared/types/region.ts` — **такого файла нет**, регионы
  живут в `shared/data/armeniaMarzes.ts`.
- `docs/client-site.md:107` пишет, что SVG-пути в `armeniaMarzes.ts` — на деле в `marzGeometry.ts`.

---

## 2. Интерактивная карта регионов

**Где**: `src/features/regions/`
- `RegionExplorer.tsx` (190 стр) — контейнер: раскрытие/сворачивание, выбор региона, загрузка туров, десктоп-панель + мобильная шторка.
- `ArmeniaMap.tsx` (133 стр) — сам SVG.
- `RegionPanel.tsx` (193 стр) — содержимое панели (4 состояния).
- Данные: `shared/data/armeniaMarzes.ts` (метаданные) + `shared/data/marzGeometry.ts` (пути).

**Как реализовано**: inline `<svg viewBox="0 0 1000 1009">`, каждый марз — отдельный
`<path d={MARZ_GEOMETRY[slug]}>`. Источник геометрии — geoBoundaries ADM1 (открытая лицензия),
equirectangular-проекция с коррекцией по cos(средней широты). Файл помечен «Generated file — do
not hand-edit». `fill-rule: evenodd` — чтобы внутренние кольца (Севан, анклавы) были дырками.
Геометрия вынесена в отдельный модуль и грузится через `React.lazy` только при раскрытии карты
(на главной карта свёрнута).

**Определение регионов**: `MarzSlug` — строковый union из 11 значений
(`'yerevan' | 'aragatsotn' | ... | 'tavush'`). Он же ключ в `MARZ_GEOMETRY`, он же значение
`tour.regionSlugs[]`, он же значение фильтра `?region=` в URL. Одна строка-идентификатор насквозь.

**Клик**: `ArmeniaMap.tsx:67` `onClick={() => onSelect(marz.slug)}` прямо на `<path>`.
Плюс `tabIndex={0}`, `role="button"`, `aria-pressed`, `onKeyDown` на Enter/Space,
`onMouseEnter/Leave/Focus/Blur` для hover-состояния. Выше по дереву
`RegionExplorer.handleSelect` → `setSelected(slug)` + `getToursByRegion(slug)` (мок с задержкой
260 мс) → `setPanel({status:'ready'|'error'})`.

Фокус: стандартный `outline` браузера убран в `.marz-path` (`index.css:175`), взамен
`:focus-visible` даёт золотой stroke — доступность с клавиатуры сохранена.

### Почему НЕ РАБОТАЕТ Ереван — найдено, причина однозначная

Три факта из кода:

1. `armeniaMarzes.ts:54` — у Еревана стоит `isEnclave: true`.
2. `ArmeniaMap.tsx:47` — кликабельные пути рисуются так:
   ```
   {MARZES.filter((m) => !m.isEnclave).map((marz) => ( <path ... onClick=... /> ))}
   ```
   **Ереван отфильтрован. Его `<path>` не рендерится вообще.**
3. `ArmeniaMap.tsx:89` — Ереван рисуется только в блоке подписей, а весь этот `<g>` имеет
   `className="pointer-events-none"`. Кружок (`<circle r={8}>`) и текст не ловят события.

**Итог: у Еревана на карте нет ни одного элемента, принимающего клик.** Ни hover-тултип,
ни выбор, ни клавиатура (Tab его не проходит — `tabIndex` только на `<path>`).

Дополнительно проверено скриптом по данным:
- `MARZ_GEOMETRY['yerevan']` **существует и корректен**: bbox `303,441 → 373,510`, то есть
  **70×69 юнитов** при viewBox 1000×1009. Это ~7% ширины карты — на телефоне 360 px это ~25 px,
  на десктопе 640 px это ~45 px. Комментарий в коде «too small to fill at this scale»
  фактически не подтверждается: фигура нормального размера, её можно заливать и кликать.
- Point-in-polygon для точки (339, 473) — центра Еревана: точка внутри **только** `yerevan`.
  У соседей (Арарат — 2 субпути, Котайк — 1) Ереван вырезан. Значит клик по точке Еревана
  сейчас не попадает вообще ни в какой path — там дырка в SVG, событие уходит в фон.
- Мок-данные корректны: тур `id:6 yerevan-city` имеет `regionSlugs: ['yerevan']`, значит
  `counts['yerevan'] === 1`. Этот тур **недостижим через карту** — единственный вход в него
  только через каталог/фильтр.

Фикс архитектурно тривиален: убрать `.filter(m => !m.isEnclave)` (или заменить на
«рисовать path всегда, а точку-маркер добавлять сверху для мелких»), маркер оставить
декоративным. Никаких новых данных не нужно — геометрия уже лежит в файле.

---

## 3. Панель региона (bottom sheet)

**Где**: разметка шторки — `RegionExplorer.tsx:169–187`; содержимое — `RegionPanel.tsx`.
Один и тот же `RegionPanel` рендерится дважды: на `lg+` как sticky-колонка сбоку
(`RegionExplorer.tsx:131–140`), ниже `lg` — как шторка. Сам `RegionPanel` layout-agnostic
(без своего позиционирования) — поэтому и переиспользуется.

**Как открывается**: условный рендер `{selectedMarz && (...)}`. То есть шторка **монтируется**
в момент выбора региона. Анимация входа — CSS keyframes `.sheet-rise` (`index.css:137`) +
`.backdrop-fade`. Явный комментарий в коде: framer-motion внутри `AnimatePresence` не
запускал вход и панель залипала за экраном на `translateY(100%)`, поэтому keyframes.

**Как закрывается** — три пути:
1. `Escape` — `useEffect` с `window.addEventListener('keydown')` (`RegionExplorer.tsx:62–69`).
2. Тап по backdrop — `<button aria-label="Закрыть">` на всю площадь (`RegionExplorer.tsx:171`).
3. Крестик в шапке панели — `RegionPanel.tsx:47`, `onClose`.

**Drag-handle сверху — ЕСТЬ, но он полностью декоративный:**
```
RegionExplorer.tsx:178
<div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline" />
```
Это пустой `div` без обработчиков, без `role`, без `tabIndex`.

**Свайп-закрытие на мобильных — НЕТ.** Проверено grep'ом по всему `src`: `onTouchStart`,
`onTouchMove`, `onTouchEnd`, `onPointerDown`, `drag`, `dragConstraints`, `useDragControls`,
`touch-action` — **ноль совпадений** во всём проекте. Единственные упоминания слова «swipe» —
в комментариях (`TourGallery.tsx:8`, `Tabs.tsx:24`), не в коде.

**Что ещё честно про текущую шторку:**
- Анимации выхода нет — при закрытии компонент размонтируется мгновенно (это отмечено в
  комментарии как осознанный trade-off).
- **Скролл фона не блокируется.** В `AdminLayout` (drawer) и в `shared/ui/Modal` блокировка
  есть (`document.body.style.overflow = 'hidden'`), в шторке региона — нет. На мобильном при
  открытой шторке страница под ней прокручивается.
- Фокус в шторку не переводится и не запирается (нет focus trap), `role="dialog"`/`aria-modal`
  на контейнере нет — в отличие от `Modal` и от admin-drawer, где это сделано.
- Высота ограничена `max-h-[78vh]`, внутренний список скроллится (`overflow-y-auto` в
  `RegionPanel.tsx:57`).

---

## 4. Тема light/dark

**Переключатель**: `src/app/layout/ThemeToggle.tsx` (44 строки). Рендерится **только** внутри
`Header` (`Header.tsx:56`), то есть только на публичном сайте. В админке переключателя нет
(и не нужен — у неё своя нетематизированная светлая палитра).

**Механика**:
- `useState<Theme>(readStoredTheme)` — состояние живёт локально в самом компоненте.
- `readStoredTheme()` читает `localStorage['hay-travel-theme']`; всё, кроме `'light'`, → `'dark'`.
- `useEffect` на `[theme]`: `document.documentElement.dataset.theme = theme` + запись в localStorage.
- `prefers-color-scheme` **не используется намеренно** (комментарий: иначе посетитель со
  светлой ОС попадёт на вторичный скин вместо задуманного тёмного).

**Где токены**: всё в одном файле `src/index.css`.
- `@theme { ... }` (строки 19–63) — Tailwind v4 генерирует утилиты из `--color-*`.
- `:root` (66–77) — тёмный скин: 9 семантических переменных.
- `[data-theme='light']` (80–91) — светлый скин: те же 9 переменных + `color-scheme: light`.
- `[data-theme='light'] .text-gold-sheen` (121–123) — отдельный тёмный градиент для заголовков.

Индирекция: `--color-page: var(--surface-page)` и т.д. → одна утилита `bg-page` работает в обеих
темах без `dark:`-префиксов.

### Что может ломать переключение именно на мобильном Android

Проверенные факты:
- `<meta name="theme-color">` в `index.html` **отсутствует** → адресная строка Chrome на Android
  остаётся дефолтной и не следует за темой. Визуально это читается как «тема не переключилась».
- `<meta name="color-scheme">` **отсутствует**.
- **Нет pre-paint скрипта** в `index.html`, который выставлял бы `data-theme` до загрузки JS.
  `data-theme` ставится только в `useEffect` после гидрации → при сохранённом `light` на первом
  кадре страница тёмная, потом мигает в светлую. На медленном мобильном это заметная вспышка.
- `body { background: var(--surface-page) }` — фон body следует теме, а вот сама палитра
  контента применяется в `RootLayout` (`bg-page text-ink`). Рассинхрона нет.
- Подписки на изменение системной темы нет (её и не должно быть — `prefers-color-scheme`
  сознательно игнорируется). Подписки на `storage`-событие (синхронизация между вкладками)
  тоже нет — не критично.
- SSR/гидрации нет вообще (чистый CSR), так что hydration mismatch исключён.

**ГИПОТЕЗА 1 (наиболее вероятная причина «на Android тема не переключается»):** Chrome for
Android имеет функцию принудительного затемнения веб-контента («Тёмная тема для сайтов» /
Auto Dark Theme). При включённой настройке браузер сам инвертирует светлые страницы. Тогда
пользователь жмёт «солнце», `data-theme='light'` реально применяется, но браузер тут же
затемняет результат — визуально «ничего не изменилось». Проверяется за минуту:
`chrome://flags` → Auto Dark Mode → Disabled, либо настройки Chrome → Специальные возможности.
Программное лечение — объявить схему на уровне документа (`<meta name="color-scheme">`,
при необходимости `color-scheme: only light` в светлом скине). **Это гипотеза, кодом не
подтверждена — нужен реальный тест на устройстве Давида.**

**ГИПОТЕЗА 2 (менее вероятная):** `localStorage.setItem` внутри `useEffect` (`ThemeToggle.tsx:28`)
не обёрнут в try/catch. В приватном режиме некоторых браузеров запись бросает исключение;
`data-theme` при этом уже выставлен (строка 27 идёт первой), но исключение из эффекта всплывёт
в error boundary. На Android Chrome в обычном режиме не воспроизводится.

**Точно НЕ причина**: `prefers-color-scheme` (не используется), hydration (нет SSR),
отсутствие подписки (тема управляется только кликом).

---

## 5. Cursor: интерактивные элементы без `cursor-pointer`

### Корневая причина — системная, а не точечная
Проект на **Tailwind CSS 4.3.3**. В Tailwind v4 из preflight убрано правило
`button { cursor: pointer }` — проверено напрямую в `node_modules/tailwindcss/preflight.css`
(единственное упоминание `cursor` там — про спиннеры Safari). Значит **каждый `<button>` в
проекте показывает стрелку, если ему явно не дали `cursor-pointer`**.

Сейчас `cursor-pointer` проставлен только в 9 местах: `shared/ui/Button.tsx:25`,
`shared/ui/Checkbox.tsx:23`, `shared/ui/Tabs.tsx:39`, `RepeaterControls.tsx:26,35,58,76`,
`TourDayCard.tsx:81`, `TourTypeToggle.tsx:40`, `ProductsTable.tsx:46,132`, `ArmeniaMap.tsx:56`.

### Список без `cursor-pointer` (файл:строка — что это)

**Публичный сайт:**
| Файл | Строка | Элемент |
|---|---|---|
| `src/app/layout/Header.tsx` | 63 | `<button>` гамбургер мобильного меню |
| `src/app/layout/LanguageSwitch.tsx` | 20 | `<button>` пилюли RU/EN/HY (×3) |
| `src/app/layout/ThemeToggle.tsx` | 34 | `<button>` переключатель темы |
| `src/app/layout/RouteErrorBoundary.tsx` | 27 | `<button>` «Обновить» |
| `src/features/regions/components/RegionExplorer.tsx` | 91 | `<button>` «Исследовать по регионам» |
| `src/features/regions/components/RegionExplorer.tsx` | 171 | `<button>` backdrop шторки |
| `src/features/regions/components/RegionPanel.tsx` | 47 | `<button>` крестик закрытия панели |
| `src/features/regions/components/RegionPanel.tsx` | 66 | `<button>` «Повторить» при ошибке |
| `src/features/tours/components/TourGallery.tsx` | 32 | `<button>` миниатюры галереи |
| `src/features/tours/components/TourItinerary.tsx` | 39 | `<button>` заголовок дня (аккордеон) |
| `src/features/tours/components/ToursFilterBar.tsx` | 41 | `<button>` сегменты Всё/Туры/Экскурсии |
| `src/features/tours/components/ToursFilterBar.tsx` | 99 | `<button>` «Сбросить» |
| `src/features/tours/ToursPage.tsx` | 63 | `<button>` «Сбросить фильтры» |
| `src/features/tours/components/BookingCard.tsx` | 37 | `<button>` «Изменить заявку» |
| `src/features/tours/components/BookingCard.tsx` | 84 | `<button>` «−» (меньше гостей) |
| `src/features/tours/components/BookingCard.tsx` | 93 | `<button>` «+» (больше гостей) |
| `src/features/tours/components/BookingCard.tsx` | 115 | `<button type="submit">` «Забронировать» |
| `src/features/auth/AuthPage.tsx` | 40 | `<button>` табы Вход/Регистрация |
| `src/features/auth/AuthPage.tsx` | 72 | `<button>` «Забыли пароль?» |
| `src/features/auth/AuthPage.tsx` | 78 | `<button type="submit">` Войти/Зарегистрироваться |

**Админка:**
| Файл | Строка | Элемент |
|---|---|---|
| `src/features/admin/layout/AdminLayout.tsx` | 46 | `<button>` гамбургер мобильного топ-бара |
| `src/features/admin/layout/AdminLayout.tsx` | 70 | `<div onClick>` backdrop drawer'а (не button — ещё и с клавиатуры недоступен) |
| `src/features/admin/layout/AdminLayout.tsx` | 84 | `<button>` крестик закрытия drawer'а |
| `src/features/admin/layout/AdminErrorBoundary.tsx` | 31 | `<button>` «Повторить» |
| `src/features/admin/products/components/ProductsTable.tsx` | 77 | `<button>` RowAction (В архив / Восстановить / Удалить) |
| `src/features/admin/products/components/ProductsTable.tsx` | 138 | `<button>` заголовок тура в строке |
| `src/features/admin/products/components/ProductsToolbar.tsx` | 28 | `<button>` ViewTab Активные/Архив |

**Дополнительно (не `<button>`, но кликабельно, курсор дефолтный):**
- `src/features/tours/components/ToursFilterBar.tsx:60` — нативный `<select>` регионов.
- `src/features/tours/components/ToursFilterBar.tsx:78` — `<input type="range">` (ползунок цены).
- `src/shared/ui/Select.tsx:20` — нативный `<select>` админки (все выпадашки формы/тулбара).
- `src/features/admin/tour-form/components/TranslationGroup.tsx:84`, `Field.tsx:26`,
  `AuthPage.tsx:111`, `BookingCard.tsx:70` — `<label>` (низкий приоритет).

**Рекомендация архитектора:** это не 27 точечных правок, а одно решение — добавить в `index.css`
базовое правило вида «`button:not(:disabled)`, `[role="button"]`, `summary`, `label` →
`cursor: pointer`». Тогда конвенция держится сама и новые компоненты не будут её нарушать.
Точечная расстановка `cursor-pointer` по 27 местам гарантированно расползётся снова.

---

## 6. Light-тема: где определены цвета, централизована ли палитра

### Где определены (полный список мест)
1. **`src/index.css:80–91`** — `[data-theme='light']`, **9 переменных**. Это единственное место,
   где светлый скин задан как таковой:
   `--surface-page #f7f1e6`, `--surface-panel #fffdf8`, `--surface-panel-raised #fffdf8`,
   `--surface-edge #e4d9c2`, `--ink-primary #221c12`, `--ink-secondary #4a4034`,
   `--ink-muted #7d6f5b`, `--accent-base #a87e2e`, `--accent-strong #8a6520`, `color-scheme: light`.
2. **`src/index.css:121–123`** — `[data-theme='light'] .text-gold-sheen`, отдельный тёмный
   градиент для золотых заголовков (иначе на кремовом выцветает).
3. **`src/index.css:19–63`** — `@theme`: фиксированные литералы, **одинаковые в обеих темах**
   (gold/wine/obsidian/cream/hairline/brand).

### Оценка централизации — палитра централизована ЧАСТИЧНО

Что переключается по теме (9 токенов): `bg-page`, `bg-panel`, `bg-panel-raised`, `border-edge`,
`text-ink`, `text-ink-dim`, `text-ink-muted`, `text-accent`, `text-accent-strong`.

Что **НЕ** переключается, но активно используется в UI (посчитано grep'ом по `src/**/*.tsx`):

| Токен | Употреблений | Тип |
|---|---|---|
| `gold*` (`--color-gold-light/gold/gold-deep`) | **131** | фиксированные литералы |
| `text-ink*` | 76 | тема-зависимые ✔ |
| `hairline` (`--color-hairline: #3a2e1c`) | **44** | **тёмный литерал, используется и в light** |
| `bg-panel` | 22 | тема-зависимый ✔ |
| `wine*` | 22 | фиксированные литералы |
| `obsidian` | 21 | тёмный литерал |
| `cream*` | 8 | светлый-на-тёмном литерал |
| `edge` (тема-зависимая граница) | **0** | **объявлен, но не используется нигде** |

Ключевые находки:
- **`--color-edge` объявлен, но не использован ни разу.** Все 44 границы/кольца в UI написаны
  как `ring-hairline` / `border-hairline`, то есть тёмно-коричневый `#3a2e1c` — он остаётся
  тёмным и в светлой теме. Это самый массовый источник «палитра не переделывается одним местом».
- Золото (131 употребление) и вино (22) не тематизированы вовсе. При смене темы они одни и те же.
  Частично компенсировано тем, что `--accent-base` в light темнее — но `--accent-*` почти нигде
  не используется, компоненты пишут `text-gold` напрямую.
- `bg-obsidian/70`, `text-cream-dim` — легитимны там, где фон гарантированно тёмный (чипы
  поверх фото, hero, тултип карты). Это задокументировано в `docs/client-site.md:81`. Но
  проверять придётся вручную — правило не выражено в коде.
- **Хардкод hex прямо в TSX**: `ArmeniaMap.tsx:58,59,95,96,106,108` — 8 литералов
  (`#8e1b38`, `#17120c`, `#f0d9a0`, `#d9b45a`, `#6b5426`, `#0f0c08`, `#c9b896`, `rgba(217,180,90,0.18)`).
  **Карта регионов в светлой теме останется тёмной** — заливка марза `#17120c` захардкожена.
- Админка палитрой не управляется вообще: `neutral-*`, `brand-*`, `#0b1220` (`AdminLayout.tsx:45`,
  `AdminSidebar.tsx:37`), `rose-*` для ошибок — всё захардкожено по месту.

**Вывод по вопросу «можно ли переделать палитру light в одном месте»**: сейчас — нет.
Одним местом (`index.css`) меняются фон, поверхности и текст. Не поменяются: все границы
(44 шт., `hairline`), все акценты (131 золото + 22 вино), заливка/обводка карты (8 hex в TSX),
вся админка. Чтобы стало «одно место», нужно: (а) перевести `hairline` → `edge`,
(б) заменить прямые `gold*`/`wine*` на `accent*`/`accent-2*` там, где фон не гарантированно тёмный,
(в) вынести цвета карты в CSS-переменные и читать их через `var()` или через классы вместо
атрибутов `fill`/`stroke`.

---

## 7. Hero-секция клиентского сайта

**Где**: `src/features/home/components/HeroSection.tsx` (88 строк). Рендерится первым в
`HomePage.tsx:23`.

**Изображение — хардкод, локальный файл:**
```
HeroSection.tsx:10
const HERO_IMAGE = '/placeholders/tatev.svg'
```
Дальше `<motion.img src={HERO_IMAGE}>` (строка 24) с медленным `scale: 1.08 → 1` за 12 с.

Файл лежит физически: `Frontend/public/placeholders/tatev.svg` (1098 байт, генерённая
SVG-заглушка «слоистые горы» в палитре сайта). Всего в `public/placeholders/` 7 файлов:
`aragats, ararat, garni, gyumri, sevan, tatev, yerevan`. Тот же `tatev.svg` используется как
обложка тура №1 — hero и карточка сейчас с одной картинкой.

Ни env-переменной, ни API, ни конфига для hero нет. Модуль-константа в одном компоненте.
Комментарий в коде объясняет выбор: удалённый сток-URL сознательно не берут, потому что hero
рисуется первым и битая/медленная картинка убивает первое впечатление. Поверх картинки —
жёсткий скрим `bg-gradient-to-t from-page via-page/70 to-page/25`, чтобы любая будущая
фотография не сломала читаемость заголовка.

---

## 8. Админка: меню, навигация, CRUD-паттерн

**Пункты меню — ровно 2**, определены в `src/features/admin/layout/AdminSidebar.tsx:15–18`:
```ts
const navItems: NavItem[] = [
  { to: '/admin',          label: 'Дашборд',  icon: '▦',  end: true },
  { to: '/admin/products', label: 'Продукты', icon: '🧳' },
]
```
Иконка — plain-текст глиф/эмодзи (осознанно: «no icon dependency»). Заметка: на публичном сайте
эмодзи запрещены доком, в админке используются.

`AdminSidebar` — чисто презентационный, `h-full`, принимает единственный проп `onNavigate`.
`AdminLayout` рендерит его **дважды**: как фиксированный рельс `w-60` на `md+` и внутри
выдвижного drawer'а на мобильных (drawer всегда смонтирован, сдвиг через inline
`style={{transform}}` — Tailwind `translate-x-*` в v4 залипал с `transition-transform`).

**Раздела настроек НЕТ.** Проверено grep'ом по всему `src`: `settings`, `setup`, `настрой`,
`справочник`, `dictionary` — ноль совпадений в коде.

**Роуты админки** (`app/router.tsx:69–102`): `/admin` (index), `/admin/products`,
`/admin/tours/new`, `/admin/tours/:id/edit`. Все четыре — через `lazy` из barrel `@/features/admin`.

### Паттерн CRUD-страницы (что копировать для нового раздела)

**Барьеры и слои** (по шагам, ровно как сделано для туров):

1. **API-модуль** — `features/admin/api/<entity>.ts`. Одна функция на эндпоинт, все через
   `apiFetch` из `@/shared/lib/http`. Никто, кроме этого модуля, не знает URL. Образец:
   `adminTours.ts` — `initTour / createTour / getAllTours / getArchivedTours / initUpdate /
   updateTour / setTourActive / setTourArchived / deleteTour`.
2. **Wire-типы** — `shared/types/attours.ts`: «тупые» DTO, зеркало бэкенда (енумы числами,
   переводы плоским списком `{type, languageCode, value}`, два семейства `*CreateModel` / `*InfoModel`).
3. **Енумы** — `features/admin/lib/enums.ts`: не TS `enum` (в tsconfig стоит `erasableSyntaxOnly`),
   а `as const`-объект + производный union-тип.
4. **Маппер** — `features/admin/lib/tourMapper.ts`: единственное место конвертации
   wire ↔ view-model. Компоненты плоский список переводов не видят никогда.
5. **View-model формы** — `features/admin/types/form.ts`: `Localized {ru, en}`,
   `LocalizedListItem {key, serverId?, text}` (`key` = `crypto.randomUUID()` для React-ключей,
   `serverId` — только у существующих записей).
6. **Список**: `<Entity>Page.tsx` экспортирует **пару** `entityLoader` + `EntityPage`.
   Loader тянет данные (`Promise.all` для параллельных запросов) и **не глушит ошибки** —
   реджект всплывает в `AdminErrorBoundary`. Страница держит: `view`, `filters`,
   `pendingId`, `actionError`, `confirmTarget`. Мутация = `runMutation(id, action, fn)` →
   вызов API → `revalidator.revalidate()`. Удаление — через `shared/ui/Modal` с подтверждением.
7. **Разбиение**: `components/<Entity>Toolbar.tsx` (стейтлесс, фильтры приходят пропсами),
   `components/<Entity>Table.tsx` (стейтлесс, только рендер + делегирование),
   `lib/filter<Entity>.ts` — **чистая функция** фильтрации, без стейта и I/O.
8. **Форма**: `useReducer` (без form-библиотек) + хук-фасад `use<Entity>Form`, отдающий
   `{state, actions, validation, hasAttemptedSubmit, submit, isSubmitting, error}`.
   Валидация — чистая функция в `lib/validation.ts`; ошибки скрыты до первого сабмита.
   Повторяющиеся списки — `LocalizedListEditor` + `RepeaterControls` (Add/Remove/▲▼).
9. **Экспорт** — только через barrel `features/admin/index.ts`. Роутер импортирует лишь оттуда.
10. **Роут** — добавить объект в `children` у `path:'admin'` c `lazy` из того же barrel
    (важно: не статичный импорт, иначе ломается код-сплит).

---

## 9. Модель тура на фронте — что есть, чего нет

Моделей **две**, и они разные:

### A. Публичная — `src/shared/types/tour.ts` (`Tour`)
Есть: `id, slug, title, kind ('tour'|'excursion'), regionSlugs: readonly MarzSlug[],
durationDays, durationNights, priceFrom, currency ('USD'|'AMD'), coverImage, gallery[],
shortDescription, rating, reviewCount, badges[], itinerary: ItineraryDay[], included[], excluded[]`.
`ItineraryDay = { day, title, description, routePoints: string[] }`.

| Поле | Есть? |
|---|---|
| Регионы | **ДА** — `regionSlugs: readonly MarzSlug[]`, many-to-many, задокументировано |
| Точки маршрута | **ДА**, но как `string[]` внутри дня — плоский текст, без id |
| Доп. расходы | **НЕТ** (частично покрыто `excluded: string[]` — просто строки) |
| Ограничения | **НЕТ** |
| Орг. детали | **НЕТ** (частично `included: string[]`) |

### B. Wire/админская — `src/shared/types/attours.ts` (`TourInfoModel` / `TourCreateModel`)
Есть: `id, type, isActive, isArchived, totalPrice?, mainImageUrl, tourDays[], translations[],
additionalExpenses[], organizationalDetails[], restrictions[]`.

| Поле | Есть? |
|---|---|
| **Регионы** | **НЕТ.** Ни в `TourCreateModel`, ни в `TourInfoModel`, ни в форме (`types/form.ts`) — упоминания регионов нет вообще |
| Точки маршрута | **ДА** — `RoutePointCreateModel/InfoModel { id?, sortOrder, translations[] }`, привязаны **к дню** (`TourDayInfoModel.routePoints`) |
| Доп. расходы | **ДА** — `AdditionalExpenseCreateModel/InfoModel { id?, amount: number\|null, translations[] }`, привязаны **к туру** |
| Ограничения | **ДА** — `RestrictionCreateModel/InfoModel { id?, sortOrder, translations[] }`, к туру |
| Орг. детали | **ДА** — `OrganizationalDetailCreateModel/InfoModel`, к туру |

**Главный структурный факт**: точки маршрута, доп. расходы и ограничения существуют как
**вложенные в тур сущности** (`sortOrder` + `translations`), создаются заново внутри каждого
тура и **не переиспользуются между турами**. Отдельных справочников нет ни на фронте, ни (судя
по `docs/backend-api.md`) на бэкенде.

**Второй структурный факт**: связь тура с регионом на фронте существует **только в моках**
публичного сайта (`shared/api/tours.ts:41` и т.д. — `regionSlugs` проставлены руками). В админской
модели и в бэкенд-контракте регионов нет. Это прямо признано в шапке `shared/api/tours.ts:8`
и в `docs/client-site.md:11`.

---

# GAP-ЛИСТ

## (a) Привязка тура к регионам

**Что уже есть**: `MarzSlug` (11 значений) как сквозной идентификатор; `Tour.regionSlugs` в
публичной модели; фильтр по региону в каталоге (`useTourFilters` + `?region=`, работает,
`ToursFilterBar.tsx:60`); `getToursByRegion` и `countToursByRegion` в моках; счётчики на карте.

**Чего нет** — по слоям:

| Слой | Gap |
|---|---|
| Wire-типы | В `TourCreateModel`/`TourInfoModel` (`shared/types/attours.ts`) нет поля регионов. Нужен контракт: скорее всего `regionIds: number[]` или `regions: RegionInfoModel[]` |
| Справочник регионов | Нет `shared/types/region.ts` (док его обещает). Нужно решить: марзы — константа фронта (`armeniaMarzes.ts`, уже есть) или сущность с бэкенда |
| Маппинг | В `tourMapper.ts` нет конвертации регионов wire ↔ форма |
| View-model формы | В `TourFormState` (`features/admin/types/form.ts`) нет поля `regionSlugs` / `regionIds` |
| Reducer | В `tourFormReducer.ts` нет экшенов `toggleRegion` / `setRegions` |
| UI админки | Нет компонента множественного выбора регионов. Место: `TourFormHeader` (рядом с типом и главной картинкой) либо отдельная секция под шапкой |
| Валидация | Нет правила «минимум 1 регион» в `tour-form/lib/validation.ts` (если оно нужно — решение Давида) |
| Публичный API | `getToursByRegion` фильтрует мок-массив. Нужен реальный вызов (`GetToursClient` с фильтром) + маппер wire → публичный `Tour` |
| **Карта (баг)** | **Ереван не кликается** — `ArmeniaMap.tsx:47` отфильтровывает `isEnclave`. Пока не починено, регион «Ереван» недостижим с карты, каким бы правильным ни был бэкенд |
| Карта → каталог | Сейчас клик по региону открывает панель со списком. Нет перехода «показать все туры региона» → `/tours?region=<slug>` (роут и фильтр уже готовы, нужна только ссылка в `RegionPanel`) |

**Порядок работ (архитектурно)**: контракт бэкенда → wire-типы → маппер → form-state + reducer →
UI-выбор регионов → починка Еревана → замена моков публичного сайта.

## (b) Новый пункт меню админки: CRUD переиспользуемых справочников

Речь про точки маршрута, доп. расходы, ограничения — сейчас они **не справочники**, а вложенные
в тур записи, создаваемые заново каждый раз.

**Чего нет:**

| Слой | Gap |
|---|---|
| Домен | Нет понятия «переиспользуемая точка маршрута/расход/ограничение». Нужна отдельная сущность с собственным id, независимая от тура |
| Бэкенд-контракт | Нет эндпоинтов справочников (`docs/backend-api.md` — только `api/Tour/*`). **Блокер: без контракта фронт делать нечего** |
| Связь | Нужно решить: тур ссылается на элемент справочника по id (общая запись) или копирует значение в момент выбора (снапшот). Это влияет на всё — от типов до поведения при редактировании справочника |
| Роуты | Нет `/admin/directories/*` (или `/admin/route-points`, `/admin/expenses`, `/admin/restrictions`) |
| Меню | В `AdminSidebar.tsx:15` нужен новый элемент. Если раздел один с вкладками — 1 пункт; если три — либо 3 пункта, либо группа (сейчас навигация плоская и без групп-заголовков, это осознанно) |
| Фича-папка | Нет `features/admin/directories/` |
| API-модуль | Нет `features/admin/api/directories.ts` |
| Wire-типы | Нет DTO справочников в `shared/types/attours.ts` |
| Переиспользование UI | `LocalizedListEditor` и `RepeaterControls` заточены под форму внутри тура; для отдельной CRUD-страницы нужен список+модалка/страница редактирования (образец — `ProductsPage` + `Modal`) |
| Интеграция в форму тура | Поля «точки маршрута / расходы / ограничения» должны получить выбор из справочника (комбобокс/пикер) вместо только ручного ввода. Компонента-пикера нет |

## (c) Раздел «Настройки/Setup» с URL hero-изображения

**Чего нет:**

| Слой | Gap |
|---|---|
| Хранилище | Негде хранить настройки. Бэкенд-эндпоинта нет; localStorage не подойдёт (настройка админа должна видеться всем посетителям); env-переменная требует пересборки и противоречит «владелец не настраивает деплой» |
| Бэкенд-контракт | Нужен `api/Settings` (GET + PUT) или аналог. **Блокер** |
| Роут | Нет `/admin/settings` |
| Меню | Нет пункта в `AdminSidebar.tsx:15` |
| Фича | Нет `features/admin/settings/` (страница + loader + форма) |
| API-модуль | Нет `features/admin/api/settings.ts` |
| Типы | Нет `SettingsModel` в `shared/types/` |
| Публичная сторона | `HeroSection.tsx:10` — константа в модуле. Нужно: `homeLoader` тянет настройки → `HomePage` передаёт URL пропсом в `HeroSection` (сам компонент остаётся презентационным). Плюс fallback на `/placeholders/tatev.svg`, если URL пустой/битый |
| Переиспользуемый контрол | Есть готовый образец «URL + живое превью + graceful fallback» — `MainImageField.tsx`. Сейчас он лежит в `tour-form/components/`; для переиспользования в настройках его надо поднять на уровень `features/admin/ui/` или `shared/ui/` |
| Обработка ошибки загрузки | На публичной стороне у `<motion.img>` нет `onError`-фолбэка (в админском превью он есть) — с внешним URL это станет реальным риском |

## (d) Промежуточный шаг на мобильных при клике по региону

Сейчас: `ArmeniaMap.onClick` → `handleSelect` → одновременно `setSelected` + загрузка туров;
шторка монтируется мгновенно и закрывает карту. Подтверждения «куда именно я попал» нет —
`hover` на тач-устройствах не срабатывает, поэтому тултип (`ArmeniaMap.tsx:120`) на телефоне
практически не показывается.

**Чего нет:**

| Слой | Gap |
|---|---|
| Состояние | В `RegionExplorer` одно состояние `selected: MarzSlug \| null`. Для двух шагов нужно различать «подсвечен/предпросмотр» и «подтверждён/открыт» — либо два поля, либо `{slug, stage: 'preview'\|'opened'}` |
| Определение платформы | Двухшаговость нужна только на тач/узком экране. В проекте нет ни хука `useMediaQuery`, ни `shared/hooks/` (папка пустая). Альтернатива без JS — рендерить оба варианта и разводить их Tailwind-брейкпоинтами (как уже сделано для панели/шторки) |
| Компонент подтверждения | Нет UI «мини-плашка: название региона + N маршрутов + [Смотреть] / [Отмена]». Данные для неё уже есть: `MARZ_BY_SLUG[slug].ru`, `.blurb`, `counts[slug]` |
| Момент загрузки | Сейчас `getToursByRegion` стартует сразу при клике. С двумя шагами решить: грузить на превью (быстрее, но лишние запросы) или на подтверждении |
| Визуальный отклик | На тач-устройстве выбранный марз меняет заливку (`isSelected → #8e1b38`), но карта тут же перекрывается шторкой — подсветку не видно. При двухшаговости подсветка наконец станет полезной |
| Свайп-закрытие | Полностью отсутствует (см. §3): drag-handle декоративный, touch-обработчиков нет ни одного |
| Блокировка скролла | Шторка не блокирует прокрутку фона (в `Modal` и admin-drawer блокировка есть) |
| Доступность шторки | Нет `role="dialog"`, `aria-modal`, focus trap — в отличие от `shared/ui/Modal` |
| Ереван | Промежуточный шаг не спасёт Ереван — он не кликается вообще (§2) |

---

# РАЗВИЛКИ — нужно решение Давида

1. **Ереван на карте.** Заливать реальным path'ом (геометрия 70×69 юнитов уже есть, работает
   как у всех) или оставить точку-маркер, но сделать её кликабельной? Вариант «path + маркер
   сверху для наглядности» тоже возможен. От этого зависит и внешний вид, и код.

2. **Регионы: константа фронта или сущность бэкенда?** 11 марзов — величина неизменная.
   Можно оставить `armeniaMarzes.ts` источником правды и хранить в БД только slug'и;
   можно завести полноценную таблицу `Region`. Первое — сильно дешевле, второе — «правильнее»
   и позволяет админу редактировать названия/описания регионов.

3. **Справочники (b): ссылка или снапшот?** Если тур ссылается на элемент справочника по id —
   правка справочника меняет все туры разом (может быть и плюсом, и катастрофой). Если копия —
   справочник работает как «библиотека заготовок». Это решение определяет всю схему БД и типов.

4. **Справочники: один раздел с вкладками или три пункта меню?** Сейчас навигация плоская,
   2 пункта, без групп — это зафиксировано в доке как осознанное. Три новых пункта её удвоят.

5. **Где хранить настройки (c)?** Без бэкенд-эндпоинта нет честного варианта: env требует
   пересборки, localStorage виден только тому, кто нажимал. Нужен `api/Settings` — или явное
   решение «пока правим URL в коде».

6. **Настройки — только hero или расширяемый набор?** От этого зависит форма контракта:
   узкий `{ heroImageUrl }` или список ключ-значение. Расширять узкий контракт позже дешевле,
   чем чинить преждевременно универсальный.

7. **Промежуточный шаг (d): определять платформу JS-хуком или CSS-брейкпоинтами?** Брейкпоинты
   надёжнее и уже используются в этом же компоненте; хук `useMediaQuery` точнее, но добавляет
   первый общий хук в пустую `shared/hooks/`.

8. **Свайп-закрытие шторки: писать руками или через framer-motion `drag`?** framer уже в
   зависимостях, но в этом самом месте от него отказались (не запускалась входная анимация).
   Ручные touch-обработчики предсказуемее, но это ~40 строк логики.

9. **Cursor: одно глобальное правило в `index.css` или 27 точечных правок?** Рекомендую
   глобальное — иначе конвенция разъедется снова на следующей фиче (корень проблемы в том, что
   Tailwind v4 убрал `cursor: pointer` у кнопок).

10. **Light-палитра: косметика или рефактор токенов?** Чтобы палитра менялась «в одном месте»,
    нужно перевести 44 использования `hairline` на `edge`, разобрать 131 использование `gold*`
    и вынести 8 hex-литералов из `ArmeniaMap`. Это заметный объём — стоит понять, планируется ли
    светлая тема как полноценный скин или как второстепенный режим.

11. **Тема на Android: сначала диагностика.** Прежде чем что-то менять в коде, стоит проверить
    на реальном телефоне, включена ли в Chrome принудительная тёмная тема (ГИПОТЕЗА 1, §4).
    От ответа зависит, нужен ли `meta color-scheme` / `color-scheme: only light` или дело в другом.

12. **Публичный сайт на моках.** Все 7 туров захардкожены в `shared/api/tours.ts`. Любая работа
    по (a) на клиентской стороне упрётся в это. Переключение на реальный API — отдельная задача,
    и её приоритет относительно (a)–(d) нужно определить.
