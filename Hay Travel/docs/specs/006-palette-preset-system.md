# Spec 006. Система палитр-пресетов + палитра «Базальт и медь» вторым пресетом

- **Дата:** 2026-08-11
- **Автор:** Frontend Architect
- **Исполнитель:** frontend-developer
- **Порядок реализации:** **задача №3 из трёх** (004 Шрифт → 005 Логин → **006 Палитра**).
  Делать последней: экран входа из 005 собран на ролевых токенах и должен переодеваться
  вместе со всем остальным — проверять это удобнее, когда он уже готов.
- **Источник решения:** предложение дизайнера `hay-palette.html` (готовый блок значений),
  утверждено Давидом.
- **ADR:** [018 — механизм пресетов](../adr/018-palette-presets-via-data-preset-attribute.md).
- **Бэкенд:** [Spec 002](002-design-settings-backend.md) + [ADR 013](../adr/013-theme-palette-preset-as-sitesetting-select.md).
  Ключи `theme.activePalette` / `theme.defaultMode` уже спроектированы, переспрашивать не нужно.

---

## Что делаем (итог)

Механизм, в котором **палитра сайта — это набор значений CSS-переменных, навешиваемый одним
атрибутом `data-preset` на `<html>`**, а выбор палитры приезжает из админки через
`theme.activePalette`. Плюс первый реальный пресет сверх дефолта — «Базальт и медь».

Три оси системы после задачи:

| Ось | Что задаёт | Кто переключает | Где живёт |
| --- | --- | --- | --- |
| **Пресет** | цветовую идею целиком | админ, один выбор — видят все | `data-preset` на `<html>` |
| **Тема** | светлый/тёмный вариант *внутри* пресета | посетитель, кнопка в шапке | `data-theme` на `<html>` |
| **Мягкий дефолт темы** | с какой темы начинает новый посетитель | админ (`theme.defaultMode`) | кэш в `localStorage` |

**Обсидиан остаётся дефолтом сайта.** Он живёт в существующих блоках `:root` /
`[data-theme='light']` и работает вообще без атрибута — то есть если бэкенд недоступен, если
ключ пустой, если посетитель первый раз, сайт выглядит ровно как сегодня.

«Базальт и медь» — **второй, не дефолтный** пресет. Давид согласился его сделать, но прямо
сказал, что палитра может быть заменена. Поэтому главное требование к реализации: **добавить,
заменить или удалить пресет должно быть операцией в четырёх строках четырёх файлов.** Ни один
компонент при этом не трогается. Если после реализации выяснится, что «добавить третий пресет»
требует чего-то ещё — значит механизм сделан неправильно.

---

## Файлы

### СОЗДАТЬ

#### 1. `Frontend/src/styles/palettes.css`

Единственное место, где живут значения непроходных пресетов. Файла `src/styles/` сейчас нет —
создать директорию.

Начать файл этой шапкой (на английском, как весь CSS проекта):

```css
/**
 * ── PALETTE PRESETS ───────────────────────────────────────────────────────────────────────────
 *
 * A preset is a full set of colour-role values, attached by `data-preset` on <html> next to
 * `data-theme` (ADR 018). Two orthogonal axes: the ADMIN picks the preset (everyone sees it),
 * the VISITOR picks dark/light within it.
 *
 * "Obsidian" is deliberately NOT here: it is the default and lives in `index.css`'s own `:root`
 * / `[data-theme='light']` blocks, so the site works with no attribute at all — offline,
 * pre-fetch, or with the backend down.
 *
 * ── Adding a preset ───────────────────────────────────────────────────────────────────────────
 * 1. Append a block PAIR below (dark, then `[data-theme='light']`), copying an existing pair.
 * 2. Add the id to `PALETTE_IDS` in `src/shared/lib/palette.ts`.
 * 3. Add its two page colours to `THEME_COLORS` in `src/shared/lib/theme.ts` AND to the
 *    duplicated `COLORS` map in the pre-paint script in `index.html`.
 * 4. Add one row to `ThemePaletteCatalog` on the backend (ATTours.Common).
 * Nothing else. No component, no card, no button is touched — every colour in the app already
 * goes through these variables.
 *
 * ── Why the selector starts with `:root` ──────────────────────────────────────────────────────
 * `:root[data-preset='x']` is (0,2,0) against the default `:root` (0,1,0), and
 * `:root[data-preset='x'][data-theme='light']` is (0,3,0) against `[data-theme='light']`
 * (0,1,0). A preset therefore wins on SPECIFICITY, not on file order — which is what lets this
 * file be `@import`ed at the TOP of index.css (CSS requires @import before other rules) and
 * survive any future reordering. Dropping the `:root` prefix would make correctness depend on
 * source order, and it would break silently, in one theme only.
 *
 * ── What a preset deliberately does NOT set ───────────────────────────────────────────────────
 *  - motion tokens (`--dur-*`, `--ease-*`, `--stagger*`) — palette-neutral, inherited;
 *  - `--shadow-*` in the DARK block — dark depth is black-based and palette-neutral, so it
 *    inherits `:root`. The LIGHT block does override them: a warm-brown shadow on cold
 *    limestone reads as dirt, exactly as a grey one does on parchment;
 *  - `--color-brand-*` — that is the ADMIN panel's teal, and `/admin` never carries a preset.
 */
```

Затем — два блока пресета «Базальт и медь». Значения дизайнера переносятся **дословно**,
единственное изменение — префикс `:root` в селекторе (причина в шапке файла выше):

```css
/* ─── PRESET: «Базальт и медь» — dark ──────────────────────────────────────────────────────── */
:root[data-preset='basalt'] {
  --surface-page:#0e1214; --surface-panel:#171c1f; --surface-panel-raised:#1e2428;
  --surface-edge:#2b3237; --surface-edge-strong:#64737c;
  --ink-primary:#eceff1; --ink-secondary:#b4bec4; --ink-muted:#86929a;

  --accent-base:#de8f5f; --accent-strong:#efae81; --accent-hover:#efae81;
  --accent-active:#c3743f; --accent-soft:#12211f; --accent-on:#0e1214;

  --gold-ink:#de8f5f; --gold-line:#7b4e30; --gold-fill:#de8f5f;
  --gold-fill-hover:#efae81; --gold-soft:rgba(222,143,95,.14); --gold-on:#0e1214;

  /* Second accent — what "wine" is in obsidian. Here: patina. */
  --color-wine:#1f5f55; --color-wine-tint:#12211f;

  /* The "always on a dark backdrop" literals are part of the preset too. */
  --color-gold:#de8f5f; --color-gold-light:#efae81; --color-gold-deep:#a9663c;
  --color-obsidian:#0e1214; --color-surface-1:#171c1f; --color-surface-2:#1e2428;
  --color-cream:#eceff1; --color-cream-dim:#b4bec4; --color-cream-muted:#86929a;

  --veil:rgba(222,143,95,.085); --veil-strong:rgba(222,143,95,.14); --seam-op:.55;

  --sem-success:#58c08f; --sem-success-soft:#0f241e;
  --sem-danger:#f0736b;  --sem-danger-soft:#2a1210;
  --sem-warning:#e3a857; --sem-warning-soft:#2a1e0c;

  --state-disabled-bg:#1e2428; --state-disabled-ink:#5c666c; --state-disabled-edge:#2b3237;
  --focus-ring:#efae81;

  --hero-ink:#fff6ee; --hero-ink-dim:#e2d6cb;
  --hero-scrim-from:rgba(14,18,20,.94); --hero-scrim-via:rgba(14,18,20,.62);
  --hero-scrim-to:rgba(14,18,20,.18);   --hero-fade:#0e1214;

  --map-sea:#0e1214; --map-region-fill:#161c1f; --map-region-muted-fill:#090c0d;
  --map-region-hover-fill:rgba(222,143,95,.18); --map-region-selected-fill:#1f5f55;
  --map-region-stroke:#7b4e30; --map-region-stroke-hover:#de8f5f;
  --map-region-stroke-selected:#efae81;
  --map-label:#b4bec4; --map-label-halo:#0e1214;
  --map-water-fill:#1d4149; --map-water-stroke:#4e858e;
  --map-tooltip-bg:rgba(14,18,20,.92); --map-tooltip-edge:rgba(169,102,60,.5);
  --map-tooltip-text:#eceff1; --map-tooltip-text-muted:#b4bec4;
}

/* ─── PRESET: «Базальт и медь» — light ─────────────────────────────────────────────────────── */
:root[data-preset='basalt'][data-theme='light'] {
  --surface-page:#edeeec; --surface-panel:#f7f7f5; --surface-panel-raised:#ffffff;
  --surface-edge:#dcdcd7; --surface-edge-strong:#7e868d;
  --ink-primary:#14191c; --ink-secondary:#3e474c; --ink-muted:#5d686f;

  --accent-base:#1a5b50; --accent-strong:#144a41; --accent-hover:#144a41;
  --accent-active:#0e382f; --accent-soft:#e2eeea; --accent-on:#f7fbf9;

  --gold-ink:#94491f; --gold-line:#b07641; --gold-fill:#c97a3c;
  --gold-fill-hover:#b87340; --gold-soft:#f6ebe1; --gold-on:#14191c;

  --color-wine:#1a5b50; --color-wine-tint:#e2eeea;

  --veil:rgba(26,91,80,.075); --veil-strong:rgba(26,91,80,.13); --seam-op:.45;

  --sem-success:#1f6b45; --sem-success-soft:#e4f0e7;
  --sem-danger:#a3211c;  --sem-danger-soft:#fbe6e3;
  --sem-warning:#8a5a08; --sem-warning-soft:#fbeedc;

  --state-disabled-bg:#e7e8e5; --state-disabled-ink:#949b9f; --state-disabled-edge:#cfd1cd;
  --focus-ring:#1a5b50;

  --hero-ink:#fff6ee; --hero-ink-dim:#e2d6cb;
  --hero-scrim-from:rgba(20,26,28,.92); --hero-scrim-via:rgba(20,26,28,.55);
  --hero-scrim-to:rgba(20,26,28,.15);   --hero-fade:#edeeec;

  --map-sea:#e4e6e2; --map-region-fill:#dde0da; --map-region-muted-fill:#f8f9f6;
  --map-region-hover-fill:#ebcbae; --map-region-selected-fill:#1a5b50;
  --map-region-stroke:#6e7a70; --map-region-stroke-hover:#b07641;
  --map-region-stroke-selected:#c97a3c;
  --map-label:#232b27; --map-label-halo:#f7f7f5;
  --map-water-fill:#b9cbce; --map-water-stroke:#6e9298;
  --map-tooltip-bg:#ffffff; --map-tooltip-edge:#b07641;
  --map-tooltip-text:#14191c; --map-tooltip-text-muted:#3e474c;

  --shadow-sm:0 1px 2px rgba(28,40,45,.07), 0 1px 3px rgba(28,40,45,.05);
  --shadow-md:0 4px 10px -2px rgba(28,40,45,.10), 0 2px 4px -2px rgba(28,40,45,.06);
  --shadow-lg:0 14px 30px -8px rgba(28,40,45,.15), 0 6px 12px -6px rgba(28,40,45,.08);
  --shadow-sheet:0 -12px 34px -10px rgba(28,40,45,.18);
}
```

**Ничего не «дописывать по недостающему».** Светлый блок намеренно не переобъявляет
`--color-gold*`, `--color-obsidian`, `--color-surface-*`, `--color-cream*` — это фиксированно-тёмные
литералы, их задал тёмный блок пресета, и в светлой теме они должны остаться теми же (они лежат
на гарантированно тёмном фоне в обеих темах). Тёмный блок намеренно не задаёт `--shadow-*` —
см. шапку файла. `color-scheme: light` тоже не нужен: базовое правило `[data-theme='light']`
продолжает применяться.

#### 2. `Frontend/src/shared/lib/palette.ts`

Полный аналог существующего `shared/lib/theme.ts` — писать в том же стиле и с такими же
доккомментариями.

```ts
/** Известные фронту id пресетов. Должны совпадать с `ThemePaletteCatalog` на бэкенде. */
export const PALETTE_IDS = ['obsidian', 'basalt'] as const
export type PaletteId = (typeof PALETTE_IDS)[number]

/** Дефолт сайта. Обсидиан — это ОТСУТСТВИЕ атрибута `data-preset`, а не отдельный блок CSS. */
export const DEFAULT_PALETTE: PaletteId = 'obsidian'

export const PALETTE_STORAGE_KEY = 'hay-travel-palette'

/** Сужение неизвестной строки (значение с сервера / из localStorage) до известного id. */
export function isPaletteId(value: string | null | undefined): value is PaletteId

/** Последний известный пресет. Неизвестное/битое/отсутствующее значение → DEFAULT_PALETTE. */
export function readCachedPalette(): PaletteId

/** Кэширует пресет для pre-paint скрипта. Молча ничего не делает, если storage недоступен. */
export function cachePalette(id: PaletteId): void

/**
 * Навешивает пресет на <html>. Для `obsidian` атрибут УДАЛЯЕТСЯ, а не выставляется:
 * дефолт — это отсутствие атрибута (ADR 018).
 */
export function applyPalette(id: PaletteId): void
```

`erasableSyntaxOnly` в tsconfig запрещает TS `enum` — поэтому `as const`-массив + производный
union, ровно как в `features/admin/lib/enums.ts`.

#### 3. `Frontend/src/shared/hooks/useSiteDesign.ts`

```ts
/**
 * Применяет дизайн-настройки сайта (`theme.activePalette`, `theme.defaultMode`) к документу.
 * Монтируется РОВНО ОДИН РАЗ — из `RootLayout`. В `/admin` не монтируется никогда.
 */
export function useSiteDesign(): void
```

Тело — два эффекта, порядок важен:

**`useLayoutEffect` (синхронно, до отрисовки):**
`applyPalette(readCachedPalette())`. Нужен для клиентского перехода `/admin → публичный сайт`:
`AdminLayout` снял атрибут (п. 10), pre-paint скрипт уже не выполнится, и без этого посетитель
увидел бы обсидиан до ответа сервера. `useLayoutEffect`, а не `useEffect`, по той же причине,
по которой он используется в `AdminLayout` — чтобы успеть до кадра.

**`useEffect` (один раз, с флагом `cancelled`):**

```
getThemeSettings().then(({ activePalette, defaultMode }) => {
  if (cancelled) return
  // 1. мягкий дефолт темы — только в свой ключ, НИКОГДА не в ключ выбора посетителя
  if (defaultMode === 'dark' || defaultMode === 'light') cacheDefaultMode(defaultMode)
  // 2. палитра
  const palette = isPaletteId(activePalette) ? activePalette : DEFAULT_PALETTE
  applyPalette(palette)
  cachePalette(palette)
  // 3. перерисовать meta[theme-color] под новую палитру — значение темы могло не измениться,
  //    поэтому полагаться только на событие ниже нельзя (React не перерендерит useTheme).
  applyTheme(readStoredTheme())
  // 4. сказать useTheme перечитать состояние (случай: посетитель без своего выбора,
  //    сервер задал defaultMode отличный от текущего)
  window.dispatchEvent(new Event(THEME_SYNC_EVENT))
})
```

Функция никогда не бросает (`getThemeSettings` уже проглатывает ошибки) — сеть легла, сайт
остаётся на закэшированном пресете.

### ИЗМЕНИТЬ

#### 4. `Frontend/src/index.css`

**4.1.** Вторая строка файла (после `@import "tailwindcss";`, который после Spec 004 стал
первой строкой):

```css
@import './styles/palettes.css';
```

Все `@import` обязаны стоять до остальных правил — поэтому подключение вверху, а корректность
приоритета обеспечивает специфичность `:root[data-preset]`, а не порядок (ADR 018).

**4.2.** В шапку блока `@theme` (после существующего комментария про gradients/tokens)
дописать предупреждение:

```
 * ── DO NOT convert this block to `@theme inline` ─────────────────────────────────────────────
 * Plain `@theme` emits these as custom properties on `:root`, and the generated utilities
 * reference them as `var(--color-…)`. That indirection is the ONLY reason a palette preset
 * (`src/styles/palettes.css`, ADR 018) can repaint the whole site by overriding the variables
 * it points at. `@theme inline` would bake the obsidian values straight into every utility:
 * the default would keep working perfectly and EVERY preset would silently stop.
```

**4.3.** Ничего в блоках `:root` и `[data-theme='light']` **не менять**. Обсидиан остаётся
дефолтом (решение Давида), и любая правка там — регрессия для основного вида сайта.

#### 5. `Frontend/src/shared/lib/theme.ts`

**5.1.** `THEME_COLORS` становится двухуровневым — цвет адресной строки зависит и от палитры:

```ts
/**
 * `theme-color` на пересечении «пресет × тема», зеркалит `--surface-page`.
 * Дублируется (неизбежно) в pre-paint скрипте `index.html` — он выполняется до любого модуля.
 * Новый пресет = новая строка ЗДЕСЬ и в том скрипте.
 */
export const THEME_COLORS: Record<PaletteId, Record<Theme, string>> = {
  obsidian: { dark: '#0f0c08', light: '#f7f1e6' },
  basalt: { dark: '#0e1214', light: '#edeeec' },
}
```

Значение `obsidian.light` (`#f7f1e6`) переносится как есть — оно уже слегка расходится с
`--surface-page` светлой темы (`#f4ede0`). Это существующее расхождение, **в этой задаче не
чиним**: правка коснулась бы дефолтной палитры, а её мы не трогаем.

**5.2.** Второй ключ хранилища и событие синхронизации:

```ts
/** Явный выбор посетителя. Пишет ТОЛЬКО переключатель в шапке. */
export const THEME_STORAGE_KEY = 'hay-travel-theme'
/** Закэшированный `theme.defaultMode` с сервера. Пишет ТОЛЬКО `useSiteDesign`. */
export const THEME_DEFAULT_STORAGE_KEY = 'hay-travel-theme-default'
/** Событие «настройки приехали, перечитай состояние» — слушает `useTheme`. */
export const THEME_SYNC_EVENT = 'hay-travel-theme-sync'
```

**5.3.** `readStoredTheme` получает трёхступенчатый приоритет (доккомментарий обновить):

```
явный выбор посетителя ('light'/'dark') → закэшированный серверный дефолт → 'dark'
```

`try/catch` вокруг обращения к `localStorage` сохранить — приватный режим/заблокированное
хранилище должны давать `'dark'`, а не падение.

**5.4.** Новая функция:

```ts
/** Кэширует серверный мягкий дефолт. Ключ ВЫБОРА посетителя не трогает — иначе дефеолт
 *  превратился бы в личный выбор навсегда и админ больше не смог бы на него повлиять. */
export function cacheDefaultMode(mode: Theme): void
```

**5.5.** `applyTheme` теперь берёт цвет с учётом палитры:

```ts
if (meta) meta.content = THEME_COLORS[readCachedPalette()][theme]
```

`persistTheme` — без изменений.

#### 6. `Frontend/src/shared/hooks/useTheme.ts`

Одна правка в существующем эффекте подписок (строки 27-40): рядом с
`window.addEventListener('storage', resyncFromStorage)` добавить

```ts
window.addEventListener(THEME_SYNC_EVENT, resyncFromStorage)
```

и симметричное снятие в cleanup. Комментарием отметить: `storage` не срабатывает в той же
вкладке, которая записала значение, поэтому серверный дефолт доезжает событием, а не через
`storage`.

**`useTheme` остаётся единственным владельцем `data-theme`** (ADR 018, вопрос 3c). Ни
`useSiteDesign`, ни что-либо ещё не должно вызывать `applyTheme` как «второй хозяин» — единственный
разрешённый вызов из `useSiteDesign` это освежение `meta[theme-color]` в шаге 3, и он передаёт
результат того же `readStoredTheme()`.

#### 7. `Frontend/src/shared/hooks/index.ts`

Добавить в barrel: `export { useSiteDesign } from './useSiteDesign'`.

#### 8. `Frontend/src/app/layout/RootLayout.tsx`

Смонтировать хук рядом с существующими, с комментарием в стиле файла:

```tsx
// Палитра-пресет + мягкий дефолт темы из админки (Spec 006). Публичный сайт только —
// `/admin` живёт на своей светлой teal-палитре и пресеты игнорирует.
useSiteDesign()
```

#### 9. `Frontend/index.html` — pre-paint скрипт

Скрипт (строки 25-52) расширяется палитрой. Заменить тело на:

```js
;(function () {
  var isAdmin = location.pathname.indexOf('/admin') === 0
  // Дублирует THEME_COLORS из src/shared/lib/theme.ts — модуль сюда импортировать нельзя,
  // скрипт обязан отработать синхронно, до стилей и бандла. Новый пресет — строка и там, и тут.
  var COLORS = {
    obsidian: { dark: '#0f0c08', light: '#f7f1e6' },
    basalt: { dark: '#0e1214', light: '#edeeec' },
  }
  var root = document.documentElement
  try {
    // Приоритет тем же порядком, что в readStoredTheme(): выбор посетителя → серверный
    // дефолт → dark.
    var chosen = localStorage.getItem('hay-travel-theme')
    var fallback = localStorage.getItem('hay-travel-theme-default')
    var preferred =
      chosen === 'light' || chosen === 'dark' ? chosen : fallback === 'light' ? 'light' : 'dark'
    var theme = isAdmin ? 'light' : preferred

    var palette = localStorage.getItem('hay-travel-palette')
    if (!COLORS[palette]) palette = 'obsidian'

    root.dataset.theme = theme
    // Обсидиан = отсутствие атрибута. `/admin` не носит пресет никогда.
    if (!isAdmin && palette !== 'obsidian') root.dataset.preset = palette
    else delete root.dataset.preset

    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', COLORS[isAdmin ? 'obsidian' : palette][theme])
  } catch (e) {
    root.dataset.theme = isAdmin ? 'light' : 'dark'
    delete root.dataset.preset
  }
})()
```

Существующий большой комментарий над скриптом сохранить и дополнить абзацем про пресет
(зачем кэш, почему одна вспышка на первый в жизни браузера заход — ADR 018, вопрос 3).

#### 10. `Frontend/src/features/admin/layout/AdminLayout.tsx`

В существующий `useLayoutEffect` (строки 44-51), который принудительно ставит светлую тему,
добавить снятие пресета — и внутрь `forceLight` тоже:

```ts
useLayoutEffect(() => {
  document.documentElement.dataset.theme = 'light'
  delete document.documentElement.dataset.preset
  function forceLight() {
    document.documentElement.dataset.theme = 'light'
    delete document.documentElement.dataset.preset
  }
  …
```

Причина — та же, что у темы, и её надо дописать в существующий комментарий: pre-paint скрипт
отрабатывает один раз при загрузке документа и не срабатывает на клиентском переходе с
публичного сайта в `/admin`; без этого админка отрисовалась бы в цветах базальта. Восстановление
на размонтировании не нужно — возврат на публичный сайт монтирует `RootLayout` → `useSiteDesign`,
который в `useLayoutEffect` вернёт закэшированный пресет (п. 3).

#### 11. `Frontend/src/shared/api/siteSettings.ts`

Рядом с существующими константами групп:

```ts
const SITE_SETTING_GROUP_THEME = 7
```

И новая функция в стиле файла:

```ts
/**
 * Дизайн-настройки сайта (`theme.*`, backend Spec 002).
 * Возвращает СЫРЫЕ строки, а не `PaletteId`/`Theme`: сузить их — работа `shared/lib/palette.ts`
 * и `useSiteDesign`, чтобы неизвестный с сервера id деградировал в дефолт, а не ломал тип.
 * Никогда не бросает; при ошибке/отсутствии ключей отдаёт пустые строки, что для вызывающего
 * означает «оставить дефолт».
 */
export interface ThemeSettings {
  activePalette: string
  defaultMode: string
}

export async function getThemeSettings(): Promise<ThemeSettings>
```

Тело — как `getContentText`: `apiFetch` группы 7, `res.values['theme.activePalette'] ?? ''`,
`res.values['theme.defaultMode'] ?? ''`, `catch` → обе пустые.

#### 12. `Frontend/src/features/admin/lib/enums.ts`

```ts
export const SiteSettingGroup = {
  … существующие …
  /** Тема оформления сайта: палитра-пресет + мягкий дефолт dark/light (backend Spec 002). */
  Theme: 7,
} as const

export const SettingValueType = {
  Text: 1,
  MultilineText: 2,
  Url: 3,
  ImageUrl: 4,
  /** Значение — один id из фиксированного набора `options`. Хранится строкой. */
  Select: 5,
} as const
```

#### 13. `Frontend/src/shared/types/attours.ts`

```ts
/** Одна опция Select-настройки. `label` — подпись для админки, не публикуется на сайте. */
export interface SiteSettingOptionModel {
  value: string
  label: string
}
```

и в `SiteSettingInfoModel` (после `sortOrder`):

```ts
/**
 * Опции для `valueType === Select`, из каталога бэкенда; в БД не хранятся.
 * Необязательное поле: бэкенд, ещё не выкативший Spec 002, его просто не пришлёт — фронт
 * не должен от этого падать.
 */
options?: SiteSettingOptionModel[]
```

`SiteSettingUpdateModel` **не трогать**: Select-ключ отправляется как любой непереводимый —
`{ key, value, translations: [] }`.

#### 14. `Frontend/src/features/admin/settings/types.ts`

В `SettingFieldState` добавить:

```ts
/** Допустимые значения для `valueType === Select`. Для остальных типов — пустой массив. */
options: SiteSettingOptionModel[]
```

#### 15. `Frontend/src/features/admin/settings/lib/settingsMapper.ts`

**15.1.** `toValueType` (строки 45-51) должен пропускать `Select`:

```ts
function toValueType(raw: number): SettingValueType {
  return raw === SettingValueType.MultilineText ||
    raw === SettingValueType.Url ||
    raw === SettingValueType.ImageUrl ||
    raw === SettingValueType.Select
    ? raw
    : SettingValueType.Text
}
```

**15.2.** В `settingsToForm` при сборке `fields[item.key]` добавить `options: item.options ?? []`.

**15.3.** `toUpdateModel` и `isUnchanged` — **без изменений**: Select ведёт себя как обычный
непереводимый ключ (`value.trim()`), отдельной ветки не требует.

#### 16. `Frontend/src/features/admin/settings/components/SettingField.tsx`

В `PlainSettingField` добавить ветку Select — **перед** финальным `return` с `Input`, рядом с
ветками `ImageUrl`/`MultilineText`/`Url`:

```tsx
if (field.valueType === SettingValueType.Select && field.options.length > 0) {
  // Значение, которого больше нет в каталоге (пресет удалили), показываем отдельной
  // disabled-опцией: иначе <select> молча отрисовал бы первую опцию, и админ бы решил,
  // что сохранено именно она.
  const known = field.options.some((o) => o.value === value)
  const options = known || value === ''
    ? field.options
    : [{ value, label: `${value} — неизвестное значение`, disabled: true }, ...field.options]

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Select
        id={id}
        surface="admin"
        value={value}
        onChange={onChange}
        options={options}
        className="max-w-sm"
      />
    </Field>
  )
}
```

Используется существующий `shared/ui/Select` (`SelectOption` уже имеет `value`/`label`/`disabled`,
`surface="admin"` даёт админскую палитру, тапабельность 44px и мобильный `Sheet` встроены).
Нативный `<select>` не заводить — его открытый список рисует ОС, и именно ради этого `Select`
и существует.

**Условие `field.options.length > 0` обязательно:** если бэкенд ещё не выкатил Spec 002 и
прислал `valueType: 5` без опций, ветка не сработает и настройка отрисуется обычным текстовым
`Input` — админ хотя бы увидит и сможет отредактировать значение, вместо пустого нередактируемого
выпадающего списка. Это тот же принцип «неизвестное рендерим, а не прячем», что уже действует
в `toValueType` и `labelFor`.

#### 17. `Frontend/src/features/admin/settings/lib/settingsCopy.ts`

```ts
// в sectionCopy
[SiteSettingGroup.Theme]: {
  title: 'Тема оформления',
  description:
    'Цветовая палитра сайта и тема, с которой сайт открывается у нового посетителя. ' +
    'Кнопка «светлая/тёмная» в шапке остаётся — посетитель может переключить сам.',
},

// в fieldCopy
'theme.activePalette': {
  label: 'Палитра сайта',
  hint: 'Меняет все цвета публичного сайта разом. Админка остаётся в своём оформлении.',
},
'theme.defaultMode': {
  label: 'Тема по умолчанию',
  hint: 'С какой темы открывается сайт у того, кто ещё ни разу не нажимал переключатель. Чужой выбор не сбрасывается.',
},
```

---

## Контракты (сводка)

```ts
// shared/lib/palette.ts
export const PALETTE_IDS: readonly ['obsidian', 'basalt']
export type PaletteId = 'obsidian' | 'basalt'
export const DEFAULT_PALETTE: PaletteId
export const PALETTE_STORAGE_KEY: 'hay-travel-palette'
export function isPaletteId(value: string | null | undefined): value is PaletteId
export function readCachedPalette(): PaletteId
export function cachePalette(id: PaletteId): void
export function applyPalette(id: PaletteId): void

// shared/lib/theme.ts (изменённое/новое)
export const THEME_DEFAULT_STORAGE_KEY: 'hay-travel-theme-default'
export const THEME_SYNC_EVENT: 'hay-travel-theme-sync'
export const THEME_COLORS: Record<PaletteId, Record<Theme, string>>
export function readStoredTheme(): Theme        // выбор → серверный дефолт → 'dark'
export function cacheDefaultMode(mode: Theme): void

// shared/api/siteSettings.ts
export interface ThemeSettings { activePalette: string; defaultMode: string }
export function getThemeSettings(): Promise<ThemeSettings>

// shared/hooks/useSiteDesign.ts
export function useSiteDesign(): void

// shared/types/attours.ts
export interface SiteSettingOptionModel { value: string; label: string }
// SiteSettingInfoModel.options?: SiteSettingOptionModel[]
```

Ни один компонент публичного сайта в этой задаче **не меняется** — в этом и смысл механизма.
Если по ходу выясняется, что для базальта надо править конкретную карточку/кнопку/секцию —
значит там сидит захардкоженный цвет мимо токенов, и это баг того места, который надо
исправить переводом на токен, а не веткой `[data-preset='basalt']`.

---

## На какой существующий паттерн ориентироваться

| Что делаете | Смотрите на |
| --- | --- |
| `shared/lib/palette.ts` | `shared/lib/theme.ts` — тот же набор read/persist/apply, тот же `try/catch` вокруг storage, те же доккомментарии |
| `useSiteDesign` | `shared/hooks/useFavicon.ts` — «сходить в публичные настройки и применить результат к документу», флаг `cancelled`, без `.catch` |
| `getThemeSettings` | `getContentText` в `shared/api/siteSettings.ts` — та же форма, тот же `catch` в пустые значения |
| Снятие атрибута в админке | `AdminLayout.tsx:44-51` — `useLayoutEffect` + `storage`-слушатель, уже написан для темы |
| Select в админ-настройках | ветки `ImageUrl`/`Url` в `SettingField.tsx` + `Select` с `surface="admin"` (как в формах тура) |
| Блоки токенов | `[data-theme='light']` в `index.css:316-410` — та же структура и порядок групп |

---

## Состояния и edge-кейсы

1. **Первый в жизни браузера заход, палитра не дефолтная.** Кэша нет → отрисовка в обсидиане →
   после ответа сервера переключение на базальт. Одна вспышка, один раз (ADR 018). Это принято.
2. **Бэкенд недоступен / ключа ещё нет.** `getThemeSettings` отдаёт пустые строки,
   `isPaletteId('')` → false → `DEFAULT_PALETTE`. Сайт в обсидиане, всё работает.
3. **Сервер прислал неизвестный id** (`neon`, опечатка, пресет удалён из фронта, но остался в
   БД). `isPaletteId` отсеивает → дефолт. Сайт **не должен** остаться без цветов.
4. **`localStorage` недоступен** (приватный режим, блокировка). Все чтения/записи в `try/catch`,
   поведение: дефолтная палитра и дефолтная тема, пресет применяется после ответа сервера.
5. **Посетитель уже выбрал тему, админ меняет `theme.defaultMode`.** Ничего не происходит —
   выбор посетителя приоритетнее. Это и есть «мягкий» дефолт.
6. **Посетитель не выбирал тему, админ меняет `defaultMode` на `light`.** При следующем заходе
   (после того как настройка закэшировалась) сайт открывается в светлой. В текущей сессии —
   переключится по событию `THEME_SYNC_EVENT`.
7. **Переход публичный сайт → `/admin` кликом (без перезагрузки).** `AdminLayout` снимает и
   тему, и пресет в `useLayoutEffect` — админка не должна мигнуть базальтом.
8. **Переход `/admin` → публичный сайт кликом.** `useSiteDesign`'s `useLayoutEffect` возвращает
   закэшированный пресет до кадра.
9. **Две вкладки, в одной переключили тему.** Работает как сейчас (`storage`-слушатель в
   `useTheme`), новый ключ `hay-travel-theme-default` этому не мешает.
10. **Админ выбрал пресет, но не сохранил / сохранил невалидное.** Валидация на сервере
    (`SiteSettingValueNotAllowed`, 2013 — Spec 002); фронт показывает существующий механизм
    ошибок формы настроек, отдельной обработки не требует.
11. **`prefers-reduced-motion`.** Смена палитры — не анимация, переход мгновенный. Никаких
    transition на смену `data-preset` **не добавлять**: 60 переменных в анимации это заметный
    джанк, а смена палитры происходит раз в месяц.

---

## Мобильная адаптивность и проверка — обязательный чек-лист

Жёсткое требование проекта. Проверять **обе палитры × обе темы × десктоп и 375px** — это
4 комбинации на экран, но без этого палитра не считается сделанной.

**Как переключать при проверке:** админка → «Настройки» → «Тема оформления» → «Палитра сайта».
Ручное `document.documentElement.dataset.preset = 'basalt'` в консоли допустимо для быстрой
итерации, но финальная проверка — через админку, целиком по реальному пути.

Экраны, которые обязаны быть просмотрены в базальте, в обеих темах:

1. **Главная** — hero (фото под затемнением остаётся кинематографичным и в светлой теме),
   надзаголовок, швы между секциями, вуали, «Избранное».
2. **Каталог `/trips`** — карточки, плашки «Тур»/«Экскурсия» (медь/патина вместо золота/вина
   — они обязаны остаться различимыми), цены, фильтры, скелетон загрузки (`.skeleton-shimmer`
   использует `--gold-soft`).
3. **Страница тура** — маршрут по дням, карточка бронирования, кнопки.
4. **Карта регионов** — отдельное внимание: регион БЕЗ туров должен отличаться от обычного
   заметно (в базальте разница специально увеличена — ΔL* ≈ 6.7 в тёмной и 8.4 в светлой
   против 3.4 в обсидиане, на что была прямая жалоба). Плюс озеро Севан, подписи, тултип,
   выбранный регион.
5. **`/auth`** (Spec 005) — фото-колонка, карточка, состояния ошибки/загрузки/успеха.
   Экран собран на ролевых токенах и обязан переодеться сам.
6. **`/account`**, шапка, подвал, нижняя панель на мобильном.
7. **`/admin`** — обязан остаться в своей teal-палитре при любом выбранном пресете. Проверить
   и прямым заходом по URL, и кликом с публичного сайта.

Дополнительно:

- **Цвет адресной строки на мобильном** (`meta[name=theme-color]`) должен совпадать с фоном
  страницы в каждой из 4 комбинаций — это единственное, что легко забыть и хорошо заметно на
  реальном телефоне.
- **Фокус** на кнопках и полях в базальте: кольцо фокуса рисуется через зазор цвета
  поверхности (`ring-offset-*` уже так и сделано), поэтому контраст меряется к поверхности.
  Проверить Tab-обходом хотя бы на форме входа и в фильтрах каталога.
- **Тени в светлом базальте холодные** (серо-синие). Убедиться, что карточки на известняке не
  выглядят «грязными».

---

## Вне скоупа

- **Смена дефолтной палитры.** Обсидиан остаётся дефолтом — решение Давида, пересмотру в этой
  задаче не подлежит.
- **Третий и последующие пресеты** («Абрикос», «Ночь Севана» из роадмапа дизайнера). Дизайнер
  прямо предложил собирать по одной. Механизм готов, но рисовать вслепую не нужно.
- **Конструктор цветов в админке** (пипетки, произвольные hex). Решено: только готовые
  пресеты (ADR 013).
- **Переключатель палитры для посетителя.** Палитру выбирает админ, посетитель — только тему.
- **Анимация перехода между палитрами** — см. edge-кейс 11.
- **Правка дефолтной палитры обсидиана**, включая расхождение `THEME_COLORS.obsidian.light`
  и `--surface-page` (п. 5.1).
- **Реализация `theme.activePalette`/`theme.defaultMode` на бэкенде** — это Spec 002,
  backend-developer. Фронт полностью работоспособен до её выкатки (edge-кейс 2).
- **Перевод оставшихся захардкоженных цветов на токены**, если такие найдутся при проверке.
  Найденное — фиксировать отдельным списком и чинить точечно, но не расширять этой задачей.
