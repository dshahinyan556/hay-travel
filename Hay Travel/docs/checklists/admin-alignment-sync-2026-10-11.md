# Sync: приведение админки к шаблонам (2026-10-11)

Общий файл для субагентов этой задачи. **Прочитать первым.** Перед завершением дописать в свой
раздел «Решения/изменения» всё, что может задеть других (новые shared-компоненты, изменённые
пропсы, новые ключи словаря). Чужие разделы не править.

Чек-лист: `docs/checklists/checklist-admin-screens-template-alignment-2026-10-11.txt`
Утверждённый Давидом макет (Продукты + Справочники): `docs/specs/admin-products-catalog-mockup-2026-10-11.html`

## Общие правила (для всех)
- Эталон экрана с правкой — `features/admin/orders/OrderDetailPage.tsx`: `DataEntryScreenLayout`,
  `AdminToolbar` в `controlZone` (он закреплён при скролле самим шаблоном), черновик + Save/Cancel.
  **Никаких кнопок Save/Cancel внизу формы/карточки/боковой панели.**
- Правило dirty: изменение засчитывается, только если значение отличается от сохранённого
  (baseline). Клик по полю, выбор того же значения, двойной клик по галочке, ввод+стирание →
  dirty = false, Save неактивен, `UnsavedChangesModal` не всплывает. Если патч вернулся к
  исходному значению — выкинуть его из черновика.
- Булевы поля в черновике — `shared/ui/Checkbox`, не `Switch`.
- Подсказки — за иконкой «?» (`HelpButton`), не инлайн-текстом.
- Нет прав → кнопка видна, но disabled + `hint` (Tooltip), как в `orders/lib/orderPermissionHints.ts`.
- Без эмодзи в UI — только SVG-иконки из `shared/ui/icons.tsx`.
- Тексты — в copy-файле фичи, обе локали (ru + en).
- Мобильная версия 375px: без горизонтального скролла страницы; тулбар на мобиле — иконки + Save
  на всю ширину (это уже умеет `AdminToolbar`).
- **Не коммитить, не делать `git add`.** Не трогать `.claude/`, `CLAUDE.md`, `agents.md`, `team.md`,
  `docs/*.md` (документацию пишет главный агент в конце).
- Проверка: только `npx tsc -b` из `Hay Travel/Frontend` (без `vite build` — параллельные сборки
  дерутся за `dist`). Браузерную проверку делает главный агент.
- Бэкенд не менять. Если без бэкенда никак — остановиться и описать в отчёте.

## Владение файлами (чужие файлы не править; нужна правка — записать сюда и сказать в отчёте)
- **Агент «Экраны»**: `orders/`, `jobs/`, `notifications/`, `notificationTemplates/`, `roles/`,
  `users/`, `settings/`, `shared/ui/{SetupFormLayout,DataEntryScreenLayout,AdminToolbar}.tsx`,
  `shared/i18n/dictionary.ts`.
- **Агент «Продукты»**: `products/`, `tour-form/`, `api/adminTours.ts`, `lib/tourMapper.ts`,
  `ui/TourTableParts.tsx`, `shared/ui/icons.tsx` (единственный, кто добавляет иконки).
- **Агент «Справочники»**: `catalog/`, `api/adminCatalog.ts`, `ui/SidePanel.tsx` (удалять, только если
  больше нигде не используется — проверить grep'ом).
- **Агент «Календарь»** (запустится позже): `calendar/`, `api/adminAvailability.ts`.
- Нужна иконка, которой нет в `icons.tsx`, а ты не «Продукты» — нарисуй локально в своей фиче и
  отметь здесь, главный агент вынесет.

## Решения/изменения — Экраны
- **`shared/ui/SetupFormLayout.tsx`:** новый проп `controlZone` (sticky, те же классы, что у
  `DataEntryScreenLayout`: `sticky top-[60px] md:top-0 -mx-4 sm:-mx-6 bg-neutral-50`); проп `footer`
  **удалён** (им пользовались только «Настройки», проверено grep'ом). Порядок шапки: title+subtitle →
  controlZone → identity → message → body.
- **`shared/ui/DataEntryScreenLayout.tsx`:** правка только комментария (убрана устаревшая ссылка на
  tab strip `CatalogPage`). `AdminToolbar` и `dictionary.ts` не менял.
- **`features/admin/ui/RichTextEditor` (ни за кем не закреплён, используется только шаблонами
  уведомлений):** аддитивно — `buildExtensions` в `useRichTextEditorInstance.ts` стал `export`;
  новый файл `lib/canonicalRichTextHtml.ts` + экспорт `canonicalRichTextHtml` из `index.ts`
  (каноническая форма HTML по схеме редактора для сравнения dirty; отбрасывает хвостовые пустые
  абзацы, которые дописывает `TrailingNode` из StarterKit на любой клик/фокус).
  **Внимание:** во время моей работы (≈23:16–23:24) эту папку параллельно переписывал кто-то ещё
  (новые `extensions/RichTable.ts`, `emailBlocks.ts`, `inlineMarks.ts`, `RichImageBlock.ts`,
  `lib/typography.ts`, правки `types.ts`/`richTextHtml.ts`/`useRichTextEditorInstance.ts`, «спека
  018») — это не я. Мой `export` у `buildExtensions` и строка в `index.ts` на момент сдачи живы; при
  их работе их нельзя терять. Ошибки tsc в `UrlFieldChips.tsx`/`LinkDialog.tsx`/`RichTextToolbar.tsx`
  — из той же параллельной работы, не мои.
- **Удалён Delete-ряд из `users/components/UserDangerZone`** (пропы `canDelete`, `deleteDisabledHint`,
  `onRequestDelete` убраны): «Удалить» пользователя — в `AdminToolbar` карточки, подтверждение —
  та же модалка `UserDangerZone` (`confirmKind = 'delete'`). «Войти как пользователь» и «Ссылка на
  смену пароля» — в «…» (`AdminActionsMenu`) тулбара карточки пользователя.
- **`users/components/UserPermissionsCard`, `UserDetailInfo`, `notificationTemplates/components/
  NotificationTemplateForm`, `roles/components/RoleForm`** стали презентационными (новые пропсы, см.
  файлы); черновик/сохранение — в страницах.
- **`settings/components/SettingsForm`:** вкладки больше не sticky (их место занял закреплённый тулбар).
- **Новые ключи copy (ru+en):** `jobsCopy.subtitle`; `notificationTemplatesCopy.noPermissionHint`;
  `rolesCopy.noPermissionHint`; `settingsCopy.noPermissionHint`, `settingsCopy.unsavedChanges(n)`;
  `userCopy.detail.saveSuperAdminHint`, `.unsavedChanges`, `.actionsGroupAccount`, `.actionsLabel(name)`,
  `userCopy.errorActions.saveChanges`.
- **Иконки:** новых не рисовал — `AlertIcon`/`CheckIcon`/`EyeIcon`/`SearchIcon` из `icons.tsx`; эмодзи
  ⚠️/✓/🔍 в баннерах моих экранов (заказ, роли, пользователи, шаблоны, задачи, уведомления) заменены.
- **`OrderDetailPage` НЕ переведён на `DataEntryScreenLayout`** (не было в задаче): его тулбар по-прежнему
  НЕ закреплён при скролле, и у заказа нет `useUnsavedChangesGuard` — вопрос к главному агенту.

## Решения/изменения — Продукты
- **Новые иконки в `shared/ui/icons.tsx`:** `RestoreIcon` (стрелка против часовой — «Восстановить»),
  `ArchiveIcon` (коробка — пустой архив), `ImageIcon` (рамка с картинкой — заглушка миниатюры).
  Ручку перетаскивания НЕ добавлял: `DragHandle` из `SortableList` уже рисует свою «решётку».
- **`shared/ui` не менял** (кроме icons). «Создать продукт» — `<Link>` (открытие в новой вкладке
  работает); классы `AdminActionButton` primary+md продублированы локально в
  `products/components/CreateProductLink.tsx` (константа `PRIMARY_LINK_CLASS`) — `buttonClassName`
  визуально не совпадает (`rounded-lg`, не `rounded-full`). Если меняется вид primary-кнопки
  тулбара — обновить и эту строку. Без права `products.Create` вместо ссылки — disabled
  `AdminActionButton` + Tooltip «Недостаточно прав».
- **`api/adminTours.ts`:** новые экспорты `MAX_FEATURED_TOURS = 9` и `isTooManyFeaturedError(err)`
  (код 2011). Используются списком продуктов и карточкой продукта.
- **`types/form.ts`** (в списке владения не указан, но это тип формы продукта, кроме tour-form его
  никто не строит): в `TourFormState` добавлено поле `isFeatured: boolean`. `lib/tourMapper.ts`:
  `infoToForm` берёт `dto.isFeatured`, `createModelToForm` — `false`.
- **`ui/TourTableParts.tsx`:** `TourThumb` получил необязательный `size?: 'sm' | 'md'` (по умолчанию
  `sm` — дашборд выглядит как раньше; `md` = 64×48 с иконкой-заглушкой).
- **Удалены** `products/components/ProductsTable.tsx` и `ProductsToolbar.tsx` (заменены на
  `ProductRow`, `FeaturedView`, `ArchiveView`, `ProductFilters`, `ProductsViewChips`). На них
  остались только упоминания в комментариях чужих файлов (`users/UsersTable.tsx`,
  `users/UsersToolbar.tsx`, `orders/components/OrderLinesGrid.tsx`) — код не зависит.
- **Шаблон «Продуктов»:** `InquiryScreenLayout` (как «Заказы»). Липкий тулбар вида «Избранные» —
  локальная обёртка с теми же классами, что `DataEntryScreenLayout` (sticky top-[60px] md:top-0).
- **Переключение вида при несохранённом черновике «Избранного»:** показывается `UnsavedChangesModal`
  со своим текстом («Переключить вид без сохранения?» / «Переключить»); подтверждение сбрасывает
  черновик, «Остаться» — остаёмся. Уход со страницы — обычный `useUnsavedChangesGuard`.
- **Карточка продукта:** Save в `TourFormScreen` теперь неактивна, пока `!isDirty` (общее правило
  черновика). Эмодзи ⚠️ в баннерах `TourFormScreen` заменены на `AlertIcon`.
- **Бэкенд-факт для всех:** архивирование НЕ снимает `IsFeatured`; сервер считает избранные из архива
  в лимит 9, а `ReorderFeatured` требует ровно ВСЕ избранные id (вместе с архивными). Список
  продуктов это учитывает (архивные избранные дописываются в конец payload, «N из 9» считает их).

## Решения/изменения — Справочники
- **`shared/ui/Tabs.tsx` (в списке владения ни за кем не закреплён) — аддитивная правка:** у `TabItem`
  новое необязательное поле `unsavedDot?: string` — синяя точка после подписи + sr-only текст из
  значения. Без поля вкладки рендерятся байт-в-байт как раньше. Можно использовать на других
  экранах с черновиком по вкладкам.
- **Иконки:** новых не понадобилось — `AlertIcon`, `ChevronDownIcon`, `ChevronRightIcon`, `SearchIcon`
  из `icons.tsx`; ручка — `DragHandle`. Эмодзи в catalog не было и нет.
- **`ui/SidePanel.tsx` НЕ удалён:** его используют `calendar/components/BulkClosurePanel.tsx` и
  `DayDetailPanel.tsx`. Удалены только SidePanel-формы каталога (`PlaceForm`, `ExpenseTemplateForm`,
  `NoteTemplateForm`, `TagForm`, `VehicleClassForm`) и хуки `lib/useCatalogReorder.ts`,
  `lib/useCatalogSearch.ts` (вне catalog не импортировались).
- **`api/adminCatalog.ts` не менял** — сохранение идёт существующими create/update/delete по строке.
- **Шаблон:** `/admin/catalog` теперь `DataEntryScreenLayout` (был `MaintenanceFormLayout`), тулбар —
  `AdminToolbar` в `controlZone`, вкладки — под ним (больше не sticky сами по себе). Комментарий в
  `DataEntryScreenLayout` про «tab strip `CatalogPage`» устарел (файл «Экранов», не правил).
- **Движок черновика таблицы** (`catalog/lib/catalogDraft.ts` — чистые функции, `useCatalogTableDraft.ts`
  — хук, `catalogSave.ts` — исполнение) универсален по `CatalogTableDef<T, V>`; при желании его можно
  вынести в общий слой для других табличных экранов — сейчас живёт в catalog.
- **Решения по UX, не описанные в макете:** у новой строки рядом с меткой «новая» есть ссылка «Убрать»
  (иначе без права Delete ошибочно добавленную строку не убрать, кроме общей «Отмены»); при ошибке
  валидации Save не отправляет НИЧЕГО (как формы раньше) и переключает на первую вкладку с ошибкой;
  при ошибке сервера по строке — остальные строки применяются, упавшие остаются в черновике.
  Регионы: тизер правится в ячейке + строка-деталь с двумя `Textarea` для длинного текста.
  Слаг точки маршрута оставлен редактируемым (как в старой `PlaceForm`), хотя в макете он серый.

## Решения/изменения — Календарь
- **Шаблон:** `/admin/calendar` — `DataEntryScreenLayout` (был `InquiryScreenLayout`). В `controlZone` (закреплён
  шаблоном) лежат `AdminToolbar` + счётчик «N изменений» и ниже `Tabs` (вкладки тоже закреплены, отдельного
  sticky-блока с ручным `top-[60px]` больше нет). Навигация по месяцам (`CalendarToolbar`) НЕ закреплена —
  стоит в теле вкладки «Календарь» над сеткой; кнопка «Массовые операции» из неё убрана (её роль — «Добавить»).
- **Черновик:** `calendar/lib/calendarDraft.ts` (чистые функции), `lib/calendarDraftSave.ts` (исполнение
  сохранения), `hooks/useCalendarDraft.ts`. Три вида правок: переключения дня (дата × область → закрыто/открыто),
  новые правила из «Добавить», пометки на удаление. Переключение хранится как желаемое состояние и выкидывается,
  если совпало с серверным (`savedClosed` берёт панель дня из серверного `CalendarDayModel`) — закрыл и открыл
  обратно = 0 изменений. Закрытие дня целиком выбрасывает из черновика узкие закрытия того же дня (они покрыты).
  Одна «причина» на ДЕНЬ (общая для всех переключений дня), сама по себе правкой не считается.
- **Сохранение:** порядок — `deleteClosureRules` (помеченные) → переключения (группа = день × направление:
  `deleteClosureRule` по одному + один `createClosureRules`, планирует тот же `planDayToggle`, поверх правил без
  уже удалённых) → новые правила по операциям «Добавить» (один `createClosureRules` на операцию). Упавшая группа
  остаётся в черновике, остальные применяются; ошибки — в слоте `message` + строка «часть сохранена».
- **Панель дня:** вместо чипов + кнопок «Закрыть/Открыть» — чекбоксы (весь день / типы / продукты с поиском),
  клик сразу пишет в черновик; метка «будет закрыт/будет открыт» рядом. `ScopeChip` остался только в
  `BulkClosurePanel`. Внизу панели кнопок применения нет. Пропсы `DayDetailPanel`/`DayClosureControls` изменились
  (`draftMarks`, `reason`, `onToggle(scope, close, savedClosed)`, `onReasonChange`).
- **Сетка:** клетки показывают результат с учётом переключений дня (`applyDraftToGrid`): синяя штриховка — будет
  закрыт, синий пунктир по контуру — есть правка в этом дне; новое/удаляемое правило из «Добавить»/таблицы лишь
  помечает задетые дни пунктиром (исход зависит от приоритетов; `closureResolver` по-прежнему НЕ рисует картинку,
  только планирует). Подписи — в `aria-label`/`title`.
- **Таблица правил:** выбор поднят на страницу (`selected` в `CalendarPage`), своей кнопки удаления и модалки
  подтверждения больше нет; «Удалить» тулбара помечает сохранённые «удалится»+«Вернуть», а новые из черновика
  просто убирает. Новые показаны с «новое» и «Убрать» (через псевдо-правила с отрицательным id). Добавлена
  колонка статуса справа, таблица `min-w-[900px]` (скролл внутри своей рамки, как раньше).
- **Удалено/переименовано в `calendarCopy.ts`:** `bulk`, `closeWholeDay`, `openWholeDay`, `wholeDayClosedNote`,
  `closedTypesTitle`, `closeTypeTitle`, `closeTypeAction`, `closedToursTitle`, `openTour`, `closeTourTitle`,
  `closeTourAction`, `bulkApplying`, `bulkConfirm*`, `rulesSelectedCount`, `rulesDelete*`; `bulkCancel` →
  `bulkClose` («Закрыть»), `bulkApply` = «Добавить в черновик». Подтверждение «>50 правил» в `BulkClosurePanel`
  убрано (ошибочную пачку теперь можно выделить и убрать из черновика).
- **Иконки:** новых не понадобилось; эмодзи ⚠️ → `AlertIcon`. `shared/ui`, `api/adminAvailability.ts`,
  `ui/SidePanel.tsx` не менял (SidePanel нужен календарю — `DayDetailPanel`/`BulkClosurePanel`).
- **Проверка:** `npx tsc -b` — в `calendar/` 0 ошибок; в выводе остались только ошибки чужого
  `ui/RichTextEditor/*` (нет `ImageSettingsPanel`, ключи словаря) — не мои. `oxlint` по `calendar/` — одно
  старое предупреждение (экспорт лоадера рядом с компонентом). Браузер и мобильный просмотр 375px НЕ
  проверялись — это за главным агентом.
