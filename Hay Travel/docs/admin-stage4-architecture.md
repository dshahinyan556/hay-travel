# ЭТАП 4 (админка) — архитектурное решение по 4.1 «Настройки»

- **Дата:** 2026-07-31
- **Статус:** решение принято, реализация не написана (дальше — `frontend-developer`)
- **Пункт чек-листа:** 4.1 «Раздел «Настройки»: hero-блок (URL+заголовок+подзаголовок+кнопка),
  контакты/соцсети, логотип, SEO»
- **Источники правды, которые НЕ пересматриваются:** `big-update-2026-07.md`,
  `checklist-big-update.txt`, `backend-stage3-architecture.md` §3.1, `backend-stage3-sync.md`
  (раздел «3.1 SiteSettings (реализовано)»), ADR 002.

Бэкенд по 3.1 закрыт и задеплоен логически. Состав ключей, их группы, переводимость и
контракт эндпоинтов — **вход этой задачи, а не её предмет**. Здесь решается только структура
фронта: где лежат файлы, какая вью-модель, какие компоненты и контракты между ними.

---

## 0. Что даёт бэкенд (сверено с кодом, не по памяти)

Проверено в `ATTours.Common/DTO/Info/SiteSettingInfoModel.cs`,
`DTO/Request/SiteSettingUpdateModel.cs`,
`Infrastructure/SiteSettings/SiteSettingCatalog.cs`,
`ATTours.Service/Services/InfoServices/SiteSettingsInfo.cs`,
`ATTours.Service/Services/UpdateServices/SiteSettingsUpdateService.cs`.

Четыре факта из реализации, которые напрямую диктуют решения ниже:

1. **`GetAll` всегда возвращает ровно каталог** (18 записей, отсортированных по `SortOrder`),
   включая ключи, которых нет в БД (`Id = 0`, значение — дефолт каталога, сегодня пустая
   строка). Экран не должен иметь собственного списка ключей — он рисует то, что пришло.
2. **Upsert идёт по `Key`.** `Id` в `SiteSettingUpdateModel` вообще нет. Значит `Id` не нужен
   ни во вью-модели, ни в состоянии формы — он умирает в маппере.
3. **`ReconcileTranslations` удаляет переводы, языка которых нет во входящем списке**
   (`SiteSettingsUpdateService.cs`, последний блок метода). Следствие, обязательное к
   исполнению: для переводимого ключа **всегда отправляются обе строки — RU и EN**, даже
   пустые. Отправить только RU = стереть EN из БД.
4. **`Update` возвращает тот же слитый список**, что и `GetAll` («чтобы админке не требовался
   повторный GetAll после сохранения» — комментарий в `UpsertAsync`). Это готовый новый
   baseline после сохранения.

Плюс: неизвестный `Key` → 400 `SiteSettingKeyUnknown`; длина и формат URL на бэке **не**
валидируются (осознанно, §3.1.5 архитектурного документа бэка).

---

## 1. Место в дереве: `features/admin/settings/`

```
Frontend/src/features/admin/
  api/
    adminSiteSettings.ts          [новый]  getAllSiteSettings(), updateSiteSettings()
  lib/
    enums.ts                      [правка] + SiteSettingGroup, SettingValueType
  types/
    localized.ts                  [новый]  Localized, LangKey — билингвальные примитивы админки
    form.ts                       [правка] re-export Localized (совместимость, 1 строка)
  ui/
    TranslationGroup.tsx          [переезд] из tour-form/components/
    ImageUrlField.tsx             [переезд] из tour-form/components/MainImageField.tsx (обобщён)
  settings/                       [новая папка]
    SettingsPage.tsx                       settingsLoader + страница-контейнер
    types.ts                               вью-модель экрана
    hooks/
      useSettingsForm.ts                   ВСЁ состояние, dirty-диф, submit
    lib/
      settingsMapper.ts                    wire <-> вью-модель + группировка + диф
      settingsCopy.ts                      RU-подписи секций и полей (только текст)
      validation.ts                        RU+EN обязательны у переводимых ключей (блокирует);
                                            остальное — мягкие предупреждения (см. §10, D4-1)
    components/
      SettingsForm.tsx                     презентационный оркестратор
      SettingsSectionCard.tsx              одна Card = одна группа
      SettingField.tsx                     диспетчер по isTranslatable / valueType
      SettingsActions.tsx                  липкая панель сохранения
  index.ts                        [правка] + export { SettingsPage, settingsLoader }
```

**Почему так, а не иначе:**

- Уровень `settings/` — ровно тот же, что `dashboard/`, `products/`, `tour-form/`: это
  подобласть фичи `admin`, а не отдельная фича. Никаких `features/settings/`.
- `api/adminSiteSettings.ts` — на уровне фичи, рядом с `adminTours.ts`, тем же стилем
  «одна плоская функция на эндпоинт через `apiFetch`». Не внутри `settings/`: клиентский сайт
  на этапе 5.2 будет дёргать `GetPublic`, и второй файл-API для тех же настроек нужно будет
  завести рядом (`shared/api/…`), а не искать его в админской подпапке.
- Вью-модель — в `settings/types.ts`, **не** в `admin/types/`. `admin/types/form.ts` лежит на
  уровне фичи потому, что её типы делят `tour-form` и `products` (через `tourMapper`). Типы
  настроек не выходят за пределы `settings/` — три интерфейса не заслуживают ни отдельной
  папки `types/`, ни выноса на уровень фичи. Файл один, без папки.
- `settingsMapper.ts` — по прямой аналогии с `lib/tourMapper.ts`: **единственное** место,
  знающее wire-формат. Ни один компонент `settings/` не импортирует
  `shared/types/attours.ts`. Это же правило зафиксировано в шапке `tourMapper.ts`, повторяем.
- Отдельного reducer'а нет (в отличие от `tour-form/reducer/`). Причина: у экрана нет ни
  добавления, ни удаления, ни перестановки элементов — только правка значений известного
  набора полей. `useReducer` здесь дал бы 15 строк экшенов ради двух операций
  (`setValue`, `setTranslation`). `useState` внутри `useSettingsForm` достаточно.
- Внешний стор (Zustand и т.п.) не заводится: состояние живёт ровно на одном экране и не
  переживает переход. Межфичевого стейта нет.

### Wire-типы

Добавляются в существующий `shared/types/attours.ts` (его заявленная роль — «1:1 зеркало
контракта бэкенда»), в отдельную секцию `Site settings`:

```ts
export interface SiteSettingInfoModel {
  id: number
  key: string
  group: number          // SiteSettingGroup
  valueType: number      // SettingValueType
  isTranslatable: boolean
  isPublic: boolean
  sortOrder: number
  value: string | null
  translations: TranslatableInfoModel[]
}

export interface SiteSettingUpdateModel {
  key: string
  value: string | null
  translations: TranslatableCreateModel[]
}
```

`SiteSettingsPublicModel` **сейчас не заводится** — она нужна только на этапе 5.2, а мёртвых
типов в контрактном файле быть не должно (тем же правилом руководствовался backend-developer,
не заводя обратные мапперы для регионов).

Enum'ы-зеркала — в `features/admin/lib/enums.ts`, в существующем стиле «frozen const object +
производный union» (в проекте `erasableSyntaxOnly`, TS-`enum` запрещён):

```ts
export const SiteSettingGroup = { Hero: 1, Contacts: 2, Social: 3, Branding: 4, Seo: 5 } as const
export const SettingValueType = { Text: 1, MultilineText: 2, Url: 3, ImageUrl: 4 } as const
```

Замечание на будущее: если на этапе 5 публичному сайту понадобится `SiteSettingGroup`,
enum переезжает в `shared/`, а не импортируется клиентской фичей из `features/admin`
(фича не импортирует фичу — только через `shared`).

### Code-splitting

Отдельный чанк не заводится. Экран целиком попадает в уже существующий admin-чанк
(`router.tsx`, один `lazy: () => import('@/features/admin')`). Вес экрана — форма из 18 полей
без библиотек; отдельный split дал бы лишний сетевой запрос без выигрыша.

---

## 2. Как плоские 18 записей превращаются в секции

**Группировка происходит в `lib/settingsMapper.ts`, один раз, на входе.** Не в компоненте и не
в хуке. Компонент получает уже готовые секции и не делает ни `filter`, ни `sort`.

### Вью-модель (`settings/types.ts`)

```ts
/** Одно редактируемое поле. `id` и `isPublic` намеренно не переносятся:
 *  upsert идёт по Key, а IsPublic на этом экране ни на что не влияет. */
export interface SettingFieldState {
  key: string                      // 'hero.title' — идентичность записи для бэка
  valueType: SettingValueType
  isTranslatable: boolean
  /** Язык-нейтральное значение. Используется ТОЛЬКО при isTranslatable === false. */
  value: string
  /** Пара RU/EN. Используется ТОЛЬКО при isTranslatable === true. */
  translations: Localized
}

/** Одна секция экрана = одна группа каталога. Только раскладка, значений не содержит. */
export interface SettingsSection {
  group: SiteSettingGroup | number   // number — на случай группы, которой фронт ещё не знает
  /** Ключи в порядке SortOrder, пришедшем с сервера. */
  keys: string[]
}

/** Состояние формы. */
export interface SettingsFormState {
  /** Единственное, что меняется при вводе. */
  fields: Record<string, SettingFieldState>
  /** Раскладка. Строится один раз из ответа сервера и при вводе НЕ меняется. */
  sections: SettingsSection[]
}
```

Разделение «`fields` (меняется) / `sections` (не меняется)» — сознательное: правка одного
поля не перестраивает и не пересортировывает список, а секции нельзя рассинхронизировать со
значениями, потому что они хранят только ключи, а не копии данных.

### Функции маппера

```ts
/** wire -> форма. Секции идут в порядке первого появления группы в списке (сервер уже
 *  отсортировал по SortOrder), ключи внутри секции — в том же порядке. */
export function settingsToForm(dto: SiteSettingInfoModel[]): SettingsFormState

/** Читает RU/EN из плоского списка переводов настройки. ИГНОРИРУЕТ поле `type`:
 *  у переводов настройки оно не несёт смысла (бэкенд отдаёт 0). Отсутствующий язык -> ''. */
function readSettingLocalized(translations: TranslatableInfoModel[]): Localized

/** Форма -> частичный payload: только изменённые относительно baseline ключи. */
export function diffToUpdateModels(
  baseline: Record<string, SettingFieldState>,
  current: Record<string, SettingFieldState>,
): SiteSettingUpdateModel[]
```

**`readLocalized` из `tourMapper.ts` не переиспользуется**: она фильтрует по `type`, а для
настроек `type` — мусорное поле. Совпадение «сегодня там 0» — случайность, на которую нельзя
закладываться. Это две разные функции в двух разных мапперах, дублирования смысла нет.

**Порядок секций берётся из данных, а не из хардкода.** Добавление ключа или целой группы в
`SiteSettingCatalog.cs` не потребует правки фронта: новое поле просто появится в своей секции.
Незнакомая группа (число вне enum) рендерится последней секцией с подписью «Прочее».
Незнакомый ключ рендерится с подписью = сам ключ (см. §7 про `settingsCopy.ts`).

### Правила сборки payload (следуют из кода бэка, нарушать нельзя)

| Случай | `value` | `translations` |
| --- | --- | --- |
| `isTranslatable === false` | `trim(value)` (пустая строка допустима) | `[]` |
| `isTranslatable === true` | `null` | **всегда две строки**: `{ type: 0, languageCode: 1, value: trim(ru) }` и `{ type: 0, languageCode: 2, value: trim(en) }` |

- `type: 0` — потому что `TranslatableCreateModel.type` обязателен по типу, а бэкенд его для
  настроек игнорирует (тот же приём, что у доп. расходов и точек маршрута в `tourMapper`).
- Отправить у переводимого ключа только RU = **удалить EN из БД** (см. §0.3).
- `value: null` у переводимого ключа — корректная семантика: `ResolveValue` для такого ключа
  читает перевод, а `Value` не смотрит вообще.

---

## 3. Переводимые поля: переиспользуем `TranslationGroup`, но поднимаем его в `admin/ui/`

**Решение:** `TranslationGroup` переезжает
`tour-form/components/TranslationGroup.tsx` → `features/admin/ui/TranslationGroup.tsx`
**без изменения разметки и пропсов**. `settings/` и `tour-form/` импортируют его оттуда.

Почему переиспользуем:

- Потребность идентична: подпись + две колонки RU|EN, флаг `multiline`, необязательная ошибка.
  Второй компонент для той же задачи = второй способ работы с билингвальной парой, ровно то,
  чего нельзя допускать.
- Компонент уже полностью презентационный: не знает ни про тур, ни про reducer, ни про API.
  Его «привязка к контексту тура» — иллюзия, созданная местом в дереве, а не кодом.
- `multiline` покрывает `MultilineText` (`hero.subtitle`, `seo.metaDescription`) без правок.
- Проверено: **все переводимые ключи имеют `ValueType` `Text` или `MultilineText`**
  (`hero.title`, `hero.subtitle`, `hero.ctaLabel`, `contacts.address`, `contacts.workingHours`,
  `seo.siteTitle`, `seo.metaDescription`). Переводимого `Url`/`ImageUrl` в каталоге нет, то
  есть расширять `TranslationGroup` не нужно. Если такой ключ когда-нибудь появится — в
  компонент добавляется проп `inputType`, а не пишется новый компонент.

Почему именно переезд, а не импорт `settings/` → `tour-form/`:

- Прямой импорт из соседней подобласти — начало циклов и «фича лезет в фичу».
  `admin/ui/` уже существует ровно для этого («общие мелкие presentational-компоненты»,
  сегодня там `TourTableParts.tsx`).
- Цена переезда мизерная: `TranslationGroup` импортируют **два файла**
  (`tour-form/components/TourDayFields.tsx`, `tour-form/components/TourFormHeader.tsx`),
  проверено grep'ом.

Сопутствующая правка типов (обязательна, иначе `settings/` потянет тип из reducer'а тура):

- `TranslationGroup` сегодня импортирует `LangKey` из
  `tour-form/reducer/tourFormReducer.ts`. Заводится `features/admin/types/localized.ts` с
  `Localized` и `LangKey` — билингвальные примитивы уровня админки.
- `types/form.ts` **ре-экспортирует** `Localized` одной строкой, `tourFormReducer.ts` —
  `LangKey` одной строкой. Все существующие импорты продолжают работать, диффа в tour-form
  почти нет.

Зафиксировано отдельным **ADR 004** (`docs/adr/004-admin-shared-form-primitives.md`) —
это правило границ, а не деталь одного экрана.

---

## 4. Сохранение: одна кнопка «Сохранить», payload — только изменённое

**Решение:** одна липкая панель внизу экрана с единственной кнопкой «Сохранить».
Отправляется **частичный список — только dirty-ключи**. Сохранения по секциям нет.

Обоснование:

- Владелец проекта не фронтендер. Одна кнопка = один понятный контракт: «поправил что угодно
  на экране, нажал один раз — сохранилось». Пять кнопок порождают вопрос «а если я поправил
  hero и SEO, а нажал только в hero?» и класс ошибок «часть изменений потеряна при уходе».
- Пять кнопок — это пять независимых `isSubmitting`, пять мест для ошибки и состояние
  «две секции сохранились, третья упала», которое придётся объяснять в UI. Для экрана из 18
  полей это дороже, чем даёт.
- Частичный payload вместо «все 18 всегда» — потому что `Update` это позволяет, и потому что
  так админка не переписывает своими же старыми значениями ключи, которых не касалась.
  Побочный эффект: строка в БД создаётся только у реально заполненных настроек.
- Ничего не изменено → кнопка неактивна, подпись «Нет изменений». Изменено → «Изменено полей:
  N». Это же место показывает ошибку сохранения.

**После успешного сохранения:**

1. Ответ `Update` (полный слитый список) прогоняется через `settingsToForm` и **становится
   новым состоянием и новым baseline**. Dirty-множество обнуляется.
2. `revalidator.revalidate()` **не вызывается** — лишний round-trip, и он создаёт классическую
   ловушку «loader отдал новые данные, а локальный state остался старым».
3. Экран остаётся на месте (в отличие от формы тура, которая уходит на `/admin/products`),
   поэтому нужна явная обратная связь: «Сохранено в HH:MM» в той же панели.

**Ошибка сохранения:** введённые значения не сбрасываются (тот же принцип, что в
`useTourForm`: «Данные формы сохранены — попробуйте ещё раз»), сообщение — в панели действий.
Отдельно обрабатывается 400 `SiteSettingKeyUnknown`: это не ошибка пользователя, а
рассинхрон фронта и каталога бэка, текст должен это говорить прямо
(«Настройка больше не поддерживается сервером — обновите страницу»).

**Валидация: RU+EN обязательны у переводимых ключей — блокирует (решение Давида, D4-1).**
У ключей с `IsTranslatable = true` (`hero.title`, `hero.subtitle`, `hero.ctaLabel`,
`contacts.address`, `contacts.workingHours`, `seo.siteTitle`, `seo.metaDescription`) оба языка
(`RU` и `EN`) обязательны — пустая строка в любом из них помечается ошибкой поля, кнопка
«Сохранить» дизейблится, пока не заполнены оба. Причина: бэк не откатывается на RU при пустом
EN (`ResolveValue`), то есть незаполненный EN буквально означает пустое место на сайте для
англоязычного посетителя — команда решила закрывать это на входе в админке, а не менять
поведение бэка. Ключи с `IsTranslatable = false` (все URL/ImageUrl/языконезависимые) остаются
необязательными — как и раньше, по ним `lib/validation.ts` даёт только мягкие подсказки (напр.
значение `Url`/`ImageUrl`, не начинающееся с `http://`, `https://` или `/`), которые **не**
мешают сохранить.

**`FormActions` из tour-form не переиспользуется**: в нём зашита кнопка «Отмена →
/admin/products» и тексты про черновик тура. Настройки получают свой `SettingsActions.tsx`
(та же липкая раскладка, свои подписи, без «Отмены» — уходить некуда).

---

## 5. Навигация и роутинг

**Путь:** `/admin/settings`. Дочерний маршрут существующей admin-ветки, тем же
`lazy: () => import('@/features/admin')`:

```ts
{
  path: 'settings',
  lazy: () =>
    import('@/features/admin').then((m) => ({ Component: m.SettingsPage, loader: m.settingsLoader })),
}
```

Ставится в `children` после `products` (порядок статических путей на матчинг не влияет —
важна читаемость). Экспорт добавляется в `features/admin/index.ts` — `router.tsx` импортирует
только оттуда.

**Загрузка:** `settingsLoader = () => getAllSiteSettings()`. Ошибка **не** глушится — летит в
`AdminErrorBoundary`, как в `productsLoader`. Страница инициализирует состояние из
`useLoaderData` один раз (ленивый инициализатор `useState`), дальше живёт локально.

**Сайдбар:** новый пункт **последним** в `navItems` (`AdminSidebar.tsx`):

```
▦ Дашборд · 🧳 Продукты · ⚙ Настройки
```

- Последним — потому что это редко используемый конфигурационный раздел, а не ежедневная
  работа; порядок «ежедневное → редкое» сохраняется.
- Иконка — глиф-строка (`⚙`), как и остальные: в проекте сознательно нет icon-зависимости.
- Навигация остаётся плоской, без групп-заголовков. На 4.2 появится «Справочники» — он
  встаёт **между** «Продукты» и «Настройки» (справочники ближе к ежедневной работе).
  4 плоских пункта — всё ещё не повод вводить группы; обоснование существующего плоского
  списка в комментарии `AdminSidebar.tsx` остаётся в силе.
- `end: true` не нужен (не индексный маршрут).

---

## 6. `ValueType.ImageUrl` — URL-строка с превью, никакой загрузки файлов

**УСТАРЕЛО (2026-08-15):** решение ниже верно исторически (на момент стадии 4.1 загрузки
файлов в проекте не было нигде), но с 2026-08-15 `ImageUrlField` умеет и загрузку файла —
см. `admin-panel.md#загрузка-файлов-изображений-2026-08-15`, `backend-api.md#загрузка-изображений-apiupload--2026-08-15`.
Контракт `ValueType.ImageUrl` не изменился (по-прежнему просто строка-URL) — загрузка лишь
добавила второй способ получить эту строку, ничего из написанного ниже не переписывалось.

**Проверено (на момент стадии 4.1):** в `Frontend/src` не было ни одного `input type="file"`,
`FormData`, `multipart` или «upload» — grep по всему `src` давал **ноль** совпадений. Загрузки
файлов в проекте не существовало ни на фронте, ни в контракте бэка. Изобретать её в 4.1
было нельзя.

**Решение:** `ImageUrl` рендерится как текстовое поле URL + живое превью справа — ровно то,
что уже делает `tour-form/components/MainImageField.tsx` (превью с фолбэком на плейсхолдер и
сбросом флага ошибки при смене URL).

Компонент **обобщается и переезжает** в `features/admin/ui/ImageUrlField.tsx`:

```ts
interface ImageUrlFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  required?: boolean
  error?: string
}
```

Что меняется относительно `MainImageField`:

- `label` и `hint` становятся пропсами (сейчас захардкожены «Главная картинка — URL»);
- `id` берётся из `useId()` вместо литерала `"main-image-url"` — **это не косметика**: на
  экране настроек три поля типа `ImageUrl` (`hero.imageUrl`, `branding.logoUrl`,
  `seo.ogImageUrl`), и три одинаковых `id` на одной странице сломали бы связь label↔input и
  доступность;
- логика превью, фолбэка и `onError` не меняется ни на строку.

`MainImageField.tsx` удаляется, `TourFormHeader.tsx` начинает звать `ImageUrlField` с
`label="Главная картинка — URL"` и тем же `hint`. Визуально форма тура обязана остаться
идентичной — это зона проверки `tester`.

**Остальные `ValueType` (не переводимые):**

| ValueType | Контрол |
| --- | --- |
| `Text` | `Field` + `Input` |
| `MultilineText` | `Field` + `Textarea` (ветка держится ради будущих ключей; сегодня непереводимых MultilineText нет) |
| `Url` | `Field` + `Input type="url" inputMode="url"`, плюс ссылка «Открыть ↗» рядом, когда значение непустое (для быстрой проверки соцсетей) |
| `ImageUrl` | `ImageUrlField` |

---

## 7. Контракты компонентов и хука

Реализация — за `frontend-developer`; здесь фиксируются границы.

### `settings/hooks/useSettingsForm.ts`

Единственный владелец состояния, дифа и сети. Ни один компонент не зовёт API напрямую.

```ts
export interface SettingsFormActions {
  setValue: (key: string, value: string) => void
  setTranslation: (key: string, lang: LangKey, value: string) => void
}

export interface UseSettingsFormResult {
  state: SettingsFormState
  actions: SettingsFormActions
  /** Количество изменённых относительно baseline ключей. 0 = сохранять нечего. */
  dirtyCount: number
  submit: () => void
  isSubmitting: boolean
  error: string | null
  /** Время последнего успешного сохранения — для подписи «Сохранено в HH:MM». */
  savedAt: Date | null
}

export function useSettingsForm(initial: SiteSettingInfoModel[]): UseSettingsFormResult
```

Внутри: `state` + `baseline` (`Record<string, SettingFieldState>`) в `useState`; `dirtyCount`
и payload считаются `useMemo` через `diffToUpdateModels`. `actions` строится один раз
(`useMemo`, как `TourFormActions`).

### Компоненты (все — презентационные, доменного состояния не держат)

```ts
// SettingsForm.tsx — оркестратор: шапка экрана, список секций, панель действий
interface SettingsFormProps {
  state: SettingsFormState
  actions: SettingsFormActions
  dirtyCount: number
  isSubmitting: boolean
  error: string | null
  savedAt: Date | null
  onSubmit: () => void
}

// SettingsSectionCard.tsx — одна Card на группу
interface SettingsSectionCardProps {
  title: string
  description?: string
  fields: SettingFieldState[]      // уже отобранные и упорядоченные родителем
  actions: SettingsFormActions
}

// SettingField.tsx — единственное место, где ветвится isTranslatable / valueType
interface SettingFieldProps {
  field: SettingFieldState
  label: string
  hint?: string
  onChangeValue: (value: string) => void
  onChangeTranslation: (lang: LangKey, value: string) => void
}

// SettingsActions.tsx — липкая панель сохранения
interface SettingsActionsProps {
  dirtyCount: number
  isSubmitting: boolean
  error: string | null
  savedAt: Date | null
  onSubmit: () => void
}
```

Раскладка: **пять `Card` друг под другом**, без вкладок. Вкладки (как в `TourForm`) прятали бы
поля и делали бы «Сохранить всё» неочевидным — админ не видит, что именно он сохраняет. 18
полей в стопке скроллятся нормально и на мобильном (`TranslationGroup` уже
`sm:grid-cols-2` → на узком экране колонки RU/EN складываются вертикально).

### `settings/lib/settingsCopy.ts`

Только текст, никакой логики:

```ts
export const sectionCopy: Record<number, { title: string; description?: string }>
export const fieldCopy: Record<string, { label: string; hint?: string }>
export function labelFor(key: string): string   // fallback -> сам key
```

Подписи обязаны быть для всех 18 ключей. Ключ, которого нет в карте, рендерится с подписью,
равной ключу, — экран не должен ломаться или молча прятать поле, если бэкенд добавил ключ в
каталог раньше, чем фронт узнал о нём (по ADR 002 это делается без миграции и без деплоя
фронта — реальный сценарий, а не гипотеза).

---

## 8. Жёсткие правила для реализации (нарушение = архитектурный дефект)

1. Компоненты `settings/` **не импортируют** `shared/types/attours.ts` и не знают слов
   `translations[].type`, `languageCode`, `id`. Весь wire-формат живёт в `settingsMapper.ts`.
2. `settings/` **не импортирует ничего из `tour-form/`** и наоборот. Общее — только через
   `admin/ui`, `admin/types`, `admin/lib`, `shared/`.
3. Список ключей на фронте **не хардкодится**. Единственный источник состава — ответ `GetAll`.
   `settingsCopy.ts` — это подписи, а не каталог: отсутствие ключа в нём не должно скрывать
   поле.
4. Для переводимого ключа в payload **всегда обе языковые строки** (§0.3).
5. `Id` настройки во вью-модель не попадает.
6. Импорты — только через алиасы `@/features/...`, `@/shared/...`; относительные пути — только
   внутри одной папки (`./SettingField`), как в существующем коде.
7. Именование: компоненты — `PascalCase.tsx` с именованным экспортом; lib/hooks —
   `camelCase.ts`; дефолтных экспортов в проекте нет.
8. Мобильная адаптивность — обязательна и проверяется реально на узком экране (правило
   `agents.md`), а не «по вёрстке».

---

## 9. Порядок реализации для `frontend-developer`

1. `shared/types/attours.ts` — секция Site settings (2 интерфейса).
2. `features/admin/lib/enums.ts` — `SiteSettingGroup`, `SettingValueType`.
3. `features/admin/types/localized.ts` + ре-экспорты в `types/form.ts` и `tourFormReducer.ts`.
4. Переезд `TranslationGroup` → `admin/ui/`; правка 2 импортов в tour-form.
5. `MainImageField` → `admin/ui/ImageUrlField.tsx` (обобщение `label`/`hint`/`useId`); правка
   `TourFormHeader.tsx`; удаление старого файла. **Форма тура обязана выглядеть как раньше.**
6. `api/adminSiteSettings.ts`.
7. `settings/types.ts` → `settings/lib/settingsMapper.ts` → `settings/lib/settingsCopy.ts`
   → `settings/lib/validation.ts`.
8. `settings/hooks/useSettingsForm.ts`.
9. Компоненты: `SettingField` → `SettingsSectionCard` → `SettingsActions` → `SettingsForm`.
10. `SettingsPage.tsx` + `settingsLoader`; экспорт в `features/admin/index.ts`; маршрут в
    `app/router.tsx`; пункт в `AdminSidebar.tsx`.

Шаги 4–5 (переезды) идут до написания `settings/`, чтобы новый код сразу импортировал
конечные пути и не пришлось переписывать импорты дважды.

---

## 10. Развилки — решены Давидом 31.07.2026

- **D4-1. Пустой EN — РЕШЕНО: требовать заполнения RU+EN в админке (вариант «а»).** Бэкенд не
  меняется (`ResolveValue` остаётся как есть — не откатывается на RU). Вместо этого у ключей
  с `IsTranslatable = true` оба языка становятся обязательными полями формы — блокирующая
  валидация в `lib/validation.ts`, кнопка «Сохранить» дизейблена, пока RU или EN пусты (см. §4
  выше). Это закрывает сценарий «пустой EN на сайте» ДО этапа 5.2, не трогая закрытый этап 3.
- **D4-2. Предупреждение при уходе со страницы — РЕШЕНО: добавить.** В отличие от формы тура
  (там осознанно нет), экран настроек получает `useBlocker`/`beforeunload` при dirty-состоянии.
  Это расхождение с формой тура осознанное и осталось только здесь — не переносить этот паттерн
  в tour-form заодно, если не попросят отдельно.
- **D4-3. Бейдж «не заполнено» — РЕШЕНО: добавить.** `Id` возвращается во вью-модель
  (`SettingFieldState.id`), пустой ключ с `id === 0` получает визуальный бейдж «не заполнено» в
  `SettingsSectionCard`/`SettingField`, чтобы сразу было видно, что ещё ни разу не
  сохранялось. Небольшое расширение объёма 4.1 против исходного плана — принято.
