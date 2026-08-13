# Spec 004. Типографическая система: Prata + Manrope

- **Дата:** 2026-08-11
- **Автор:** Frontend Architect
- **Исполнитель:** frontend-developer
- **Порядок реализации:** это **задача №1 из трёх** (004 Шрифт → 005 Логин → 006 Палитра).
  Делать первой: 005 и 006 опираются на новую шкалу и на очищенный `index.css`.
- **Источник решения:** предложение дизайнера, вариант **C «Витрина»**
  (`hay-fonts.html`), утверждён Давидом. Пересмотру не подлежит.
- **ADR:** не требуется — смена гарнитуры не архитектурная развилка, все решения ниже
  приняты и зафиксированы прямо здесь.

---

## Что делаем (итог)

| Роль | Было | Стало |
| --- | --- | --- |
| Заголовки (`font-display`) | Cormorant Garamond 500/600/700 | **Prata 400** (единственный вес, курсива нет) |
| Текст и UI (`font-sans`) | Inter 400/500/600 | **Manrope 400–700** (variable) |
| Название тура в карточке | Cormorant 20/21px | **Manrope 600, 19px** |

Плюс: пересчитанная шкала заголовков (у Prata крупнее строчная — те же пиксели читаются
больше), правило «Prata только от 24px», починка перевёрнутого `h3-sub` (сейчас на мобильном
крупнее, чем на десктопе), и снятие синтетического жира с логотипа.

Смена `--font-sans` глобальная — **админка тоже переезжает на Manrope**. Это осознанно:
токен один на всё приложение, а Manrope в админских таблицах читается не хуже Inter.
Цвета админки (`brand-*`, белые поверхности) не трогаем вообще.

---

## Файлы

### 1. `Frontend/index.html` — ИЗМЕНИТЬ

Подключение шрифтов переезжает из CSS в `<head>`. В блок `<head>`, **сразу после**
`<meta name="viewport" …>` и **до** `<meta name="color-scheme">`, вставить:

```html
<!-- Шрифты подключены здесь, а не через `@import` в index.css, намеренно: `@import` внутри
     CSS сериализует загрузку (браузер сначала должен скачать и распарсить index.css, только
     потом обнаружит запрос к fonts.googleapis.com, и лишь потом дойдёт до самих файлов
     шрифтов). Для дисплейной гарнитуры на H1 первого экрана это видимая поздняя подмена.
     `<link>` в разметке подхватывает preload-сканер браузера, и запрос уходит параллельно
     с таблицей стилей. `preconnect` к gstatic обязателен с `crossorigin` — файлы шрифтов
     запрашиваются в CORS-режиме.
     Manrope запрашивается как variable-шрифт одним диапазоном `wght@400..700` — это один
     файл вместо четырёх статических начертаний. У Prata один вес (400) и оси нет. -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..700&family=Prata&display=swap"
/>
```

Кириллица отдельно не запрашивается: `css2` отдаёт подмножества с `unicode-range`, браузер
скачает кириллический поднабор только там, где он реально используется.

`display=swap` сохраняем — как и было.

### 2. `Frontend/src/index.css` — ИЗМЕНИТЬ

**2.1. Удалить строку 1** целиком:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
```

`@import "tailwindcss";` становится первой строкой файла.

**2.2. Токены гарнитур в `@theme` (сейчас строки 27–28):**

```css
--font-sans: 'Manrope', ui-sans-serif, system-ui, sans-serif;
--font-display: 'Prata', 'Bodoni MT', Didot, Georgia, serif;
```

Фолбэки для Prata — дидоны/переходные антиквы, чтобы при неудачной загрузке страница не
уезжала в системный гротеск.

**2.3. Комментарий в шапке `@theme` (сейчас строка 11)** переписать:

```
 * Only two typefaces: Prata for display headings (`font-display`), Manrope for everything
 * else (`font-sans`). Prata has ONE weight (400) and no italic — never pair `font-display`
 * with `font-bold`/`font-semibold`/`italic`, the browser would synthesise them and a didone
 * smears badly under synthetic bold. Below 24px use Manrope 600 instead of Prata: the
 * hairline strokes disappear at small sizes (this is why `.card-title` is no longer display
 * type). The wordmark in Header/Footer is the one documented exception.
```

**2.4. Блок системы заголовков (сейчас строки 462–479)** — новые размеры:

```css
.h1-page {
  /*
   * `leading-[1.2]` остаётся и с Prata — и по той же причине, что была с Cormorant:
   * `.text-gold-sheen` использует `background-clip: text`, градиент обрезается по line-box,
   * и при более плотном интерлиньяже у «у»/«р»/«g» срезаются хвосты. НИКОГДА не опускать
   * интерлиньяж ниже 1.15 на элементе с `.text-gold-sheen`.
   */
  @apply max-w-[20ch] font-display text-[44px] leading-[1.2] lg:text-[52px];
}
.h2-section {
  @apply max-w-[17ch] font-display text-[34px] leading-tight lg:text-[42px];
}
.h3-sub {
  /* Было 32/lg:28 — то есть на мобильном КРУПНЕЕ, чем на десктопе. Это чинится заодно. */
  @apply font-display text-[26px] leading-snug lg:text-[28px];
}
.card-title {
  /*
   * Больше не дисплейная гарнитура. Prata на 19–21px теряет волосяные штрихи и читается
   * «бледно», а не «дорого» — а на этом размере живёт половина типографики каталога.
   * Manrope 600 даёт и читаемость, и различие «крупный заголовок = событие,
   * мелкий = информация». Брейкпоинта у размера больше нет — 19px в обеих ширинах.
   */
  @apply font-sans text-[19px] leading-snug font-semibold;
}
```

**2.5. `.section-eyebrow` (сейчас строка 486)** — добавить вес:

```css
.section-eyebrow {
  @apply inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-gold-ink uppercase;
}
```

Размер и разрядка не меняются — только вес 400 → 600 (у Manrope на 11px разрядка без веса
рассыпается).

**2.6. `.text-gold-sheen` и `[data-theme='light'] .text-gold-sheen` — НЕ ТРОГАТЬ.**
Градиентные остановки завязаны на цвет, не на гарнитуру.

### 3. `Frontend/src/app/layout/RootLayout.tsx` — ИЗМЕНИТЬ

Межстрочный интервал корпуса 1.6 → **1.62** (у Manrope шире буква, строке нужно чуть больше
воздуха). Ставится **не на `body`**, а на корневой div публичной оболочки — иначе разрежённые
строки уедут в плотные таблицы `/admin`, у которых своя оболочка:

```tsx
<div className="flex min-h-screen flex-col bg-page pb-24 leading-[1.62] text-ink lg:pb-0">
```

`body` в `index.css` остаётся как есть (`@apply font-sans antialiased` + `background`).

### 4. `Frontend/src/features/home/components/HeroSection.tsx` — ИЗМЕНИТЬ

Строка 87, класс `<motion.h1>`:

```
было:  text-gold-sheen mt-4 max-w-3xl font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl
стало: text-gold-sheen mt-4 max-w-3xl font-display text-[44px] leading-[1.1] sm:text-[56px] lg:text-[68px]
```

Было 48/60/72 → стало 44/56/68: Prata плотнее, на 72px строка становится тяжёлой и в
двухстрочном заголовке начинает «падать». Интерлиньяж 1.05 → 1.1 — обязательно, см. пункт 2.4
(тот же `.text-gold-sheen` с обрезкой по line-box).

### 5. Перевод мелкой типографики с Prata на Manrope 600

**Правило, по которому это сделано (записать в код нельзя — записано здесь):**
`font-display` допустим **только на размере ≥ 24px**. Всё, что мельче, — `font-sans` +
`font-semibold`. Единственное исключение — логотип (пункт 6).

Во всех перечисленных местах: убрать `font-display`, добавить `font-semibold`. Размер
и остальные классы не менять, если рядом не сказано иное.

| Файл | Строка | Было | Стало |
| --- | --- | --- | --- |
| `shared/ui/DatePicker.tsx` | 354 | `font-display text-base` | `font-semibold text-base` |
| `features/tours/TourDetailPage.tsx` | 133, 148, 163, 175, 187 | `font-display text-lg` | `font-semibold text-lg` |
| `features/tours/components/BookingCard.tsx` | 76 | `font-display text-xl` | `font-semibold text-xl` |
| `features/tours/components/BookingCard.tsx` | 175 | `font-display text-xl` | `font-semibold text-xl tabular-nums` |
| `features/tours/components/TourItinerary.tsx` | 51 | `font-display text-sm` | `font-semibold text-sm tabular-nums` |
| `features/tours/components/TourItinerary.tsx` | 60, 69 | `font-display text-lg` | `font-semibold text-lg` |
| `features/regions/components/RegionPreviewBar.tsx` | 60 | `font-display text-xl` | `font-semibold text-xl` |
| `features/regions/components/RegionPanel.tsx` | 178 | `font-display text-base` | `font-semibold text-base` |
| `features/regions/components/RegionPanel.tsx` | 190 | `font-display text-lg` | `font-semibold text-lg` |
| `features/regions/components/RegionPanel.tsx` | 236 | `font-display text-lg` | `font-semibold text-lg` |
| `features/regions/components/RegionExplorer.tsx` | 279 | `font-display text-lg` | `font-semibold text-lg` |
| `features/regions/components/ArmeniaMap.tsx` | 228 | `font-display select-none` | `font-semibold select-none` |
| `features/regions/components/ArmeniaMap.tsx` | 255 | `font-display text-lg` | `font-semibold text-lg` |
| `features/home/components/Testimonials.tsx` | 106 | `font-display text-lg leading-relaxed` | `text-[19px] leading-relaxed` |

Пояснения к неочевидным строкам:

- **`BookingCard:175`** и **`TourItinerary:51`** — это числа (счётчик гостей, номер дня).
  `tabular-nums` добавляется, чтобы ширина не прыгала на переходе 9 → 10.
- **`ArmeniaMap:228`** — подписи регионов в SVG (`fontSize` 25/30 в единицах viewBox, то есть
  на экране заметно мельче). Волосяная дидона с гало поверх заливки региона смазывается —
  это информационная подпись, её место в гротеске.
- **`Testimonials:106`** — цитата отзыва. Уходит в Manrope и подрастает 18 → 19px, чтобы не
  потерять вес высказывания. **Курсив не добавлять** — у Manrope нет наклонного начертания,
  браузер синтезирует его наклоном, и это выглядит дёшево.

**Места, где `font-display` ОСТАЁТСЯ (≥24px, ничего не менять):**
`ToursPage.tsx:114` (24), `TourDetailPage.tsx:109` и `:237` (24), `RegionPanel.tsx:70` (24),
`RouteErrorBoundary.tsx:25` (36), `NotFoundPage.tsx:13` (36), `AuthShell.tsx:47` (30 — этот
экран отдельно перерабатывается в Spec 005, здесь не трогать).

### 6. Логотип — снять синтетический жир

`Header.tsx:66` и `Footer.tsx:92` — единственное исключение из правила «≥24px»: логотип
остаётся дисплейной гарнитурой на любом размере, это логотип, а не текст. Но **`font-semibold`
из обоих убрать**: у Prata один вес 400, и `font-semibold` заставит браузер синтезировать
полужирный — дидону это разносит в кашу заметнее любой другой гарнитуры.

```
Header.tsx:66
было:  text-gold-sheen font-display text-base leading-none font-semibold tracking-wide sm:text-2xl
стало: text-gold-sheen font-display text-base leading-none tracking-wide sm:text-2xl

Footer.tsx:92
было:  text-gold-sheen font-display text-xl font-semibold tracking-wide
стало: text-gold-sheen font-display text-xl tracking-wide
```

---

## Контракты

Новых типов, хуков и компонентов задача **не вводит**. Единственные публичные «контракты» —
CSS-классы, и они сохраняют имена: `.h1-page`, `.h2-section`, `.h3-sub`, `.card-title`,
`.section-eyebrow`. Ни один вызывающий компонент не меняет разметку из-за них.

Токены Tailwind `font-sans` / `font-display` тоже сохраняют имена. То есть: **ни один импорт,
ни один prop, ни один тип в проекте не меняется.** Правится только CSS и списки классов.

---

## На какой существующий паттерн ориентироваться

- Класс-роли в `index.css` (`.h1-page`/`.h2-section`/`.card-title`, строки 462–479) — это
  готовый паттерн «размер заголовка задан один раз в CSS, а не `text-3xl sm:text-4xl` в
  каждом компоненте». Новые размеры вставляются ровно туда же, новых классов не добавляем.
- Формат комментариев в `index.css` — развёрнутый блок с «почему», а не «что». Все пояснения
  выше писать в этом же стиле, на английском (файл целиком на английском).

---

## Состояния и edge-кейсы

1. **FOUT (вспышка системного шрифта до загрузки).** `display=swap` оставлен намеренно:
   текст виден сразу подстановочным шрифтом. Проверить, что при подмене не рвётся вёрстка
   первого экрана — `max-w-3xl` на hero-заголовке и `max-w-[20ch]` на `.h1-page` уже
   ограничивают строку, так что скачок ширины ограничен переносом строки. Дополнительных
   `size-adjust`/local-фолбэков **не вводить** — преждевременная оптимизация.
2. **Шрифты не загрузились (блокировщик, офлайн, Google недоступен).** Prata → `Bodoni MT`/
   `Didot`/`Georgia`; Manrope → системный гротеск. Проверить оба экрана визуально, заблокировав
   `fonts.gstatic.com` в DevTools → сайт должен остаться читаемым, а не сломанным.
3. **Синтетический жир.** После правок прогнать `rg "font-display"` и убедиться, что рядом ни
   в одном месте нет `font-bold`, `font-semibold`, `font-medium` или `italic`. Сейчас таких
   мест ровно два — Header и Footer (пункт 6).
4. **`leading` на `.text-gold-sheen`.** Ни на одном элементе с этим классом интерлиньяж не
   должен быть меньше 1.15 — иначе градиент обрежет хвосты букв. Затрагивает `.h1-page`,
   `.h2-section`, hero-H1, логотип (у логотипа `leading-none` — но там заглавные латинские
   буквы без выносных, это допустимо и остаётся как есть).
5. **Админка.** Manrope приезжает и туда. Проверить, что в таблицах `/admin` (Продукты,
   Пользователи) строки не поехали: `leading-[1.62]` туда НЕ попадает (пункт 3), а ширина
   Manrope шире Inter примерно на 2–3 % — колонки должны выдержать. Если где-то в админке
   заголовок таблицы стал переноситься — это баг, а не «так и надо».

## Мобильная адаптивность — обязательная проверка

Правило проекта: адаптивность проверяется реальным просмотром на узком экране, не только
десктопом. Для этой задачи проверить **на 375px и на 320px (iPhone SE)**:

1. **Hero, главная** — заголовок 44px не должен вылезать за границы и не должен разваливаться
   на 4+ строки. Длинные слова русского заголовка (`hero.title` — админ-редактируемый текст!)
   проверить на заведомо длинном значении.
2. **`/trips`** — `.h1-page` 44px + `max-w-[20ch]`.
3. **`/tours/:id`** — `.h1-page` с названием тура; в названиях есть длинные топонимы.
4. **Карточка тура** — `.card-title` 19px Manrope 600, `line-clamp-2` должен по-прежнему
   давать ровно 2 строки, а не 2.5.
5. **`.h3-sub`** — 26px на мобильном (было 32). Убедиться, что стало меньше, а не больше.
6. **Карта регионов** — подписи регионов в гротеске, читаются на 375px.
7. **Нижняя панель `MobileTabBar`** — подписи `text-[11px]` в Manrope шире, чем в Inter.
   Проверить, что «Путешествия» не обрезается и 4 таба помещаются на 320px.
8. **Шапка** — логотип `text-base` на мобильном, без `font-semibold`; убедиться, что он не
   стал выглядеть тонким/потерянным рядом с иконками.

---

## Вне скоупа

- Самохостинг шрифтов (`@font-face` + файлы в `public/`). Google Fonts остаётся — площадка
  статическая, владелец проекта не занимается инфраструктурой, а Netlify + Google Fonts это
  ноль ручных действий. Вернуться к вопросу, только если появится реальная жалоба на скорость.
- Подгонка метрик фолбэка (`size-adjust`, `ascent-override`) — см. edge-кейс 1.
- Любые изменения цветов, палитры, теней — это Spec 006, не эта задача.
- Редизайн `/auth` — Spec 005. В `AuthShell.tsx` в этой задаче меняется **ничего**.
- Замена гарнитуры в письмах бэкенда, в PDF, в `netlify/edge-functions/seo-meta.ts` — не
  относится.
- Ввод новых классов-ролей (`.h4-*`, `.body-lg` и т. п.). Текущих четырёх хватает; плодить
  роли под 3 фичи вперёд не нужно.
