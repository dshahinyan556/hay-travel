# Спецификация 011. Общий rich-text редактор админки (Tiptap)

- **Дата:** 2026-08-22 (обновлена 2026-08-22 после ответов Давида — см. §8)
- **Автор решения:** architect
- **Исполнитель:** ui-ux-engineer
- **Почему так:** [ADR 023](../adr/023-rich-text-editor-on-tiptap.md)
- **Требования к бэкенду:** [спека 012](012-rich-text-editor-backend-requirements.md) — **обязательна к
  выполнению до выката фазы 1 в прод** (§9)
- **Ограничение-контракт:** [architecture-role-notifications.md §E.5](../architecture-role-notifications.md)
  (allow-list санитайзера) и §E.4 (синтаксис `{{Token}}`)

Фаза 1 — единственное, что реализуется по этой спеке. Фаза 2 описана ниже, чтобы API её учитывал,
но **её код в этой задаче не пишется**.

---

## 0. Что чиним (для контекста, не для угадывания)

1. Размер + цвет: второе действие отменяет первое.
2. Выделение мышью + «Ж» не применяет жирность к выделению.
3. Плейсхолдеры не вставляются и непонятны нетехническому пользователю.

Причины разобраны в ADR 023 (раздел «Контекст»). Все три уходят структурно: Tiptap держит
selection в своём состоянии, `chain().focus()` его восстанавливает, а контент никогда не
переписывается через `innerHTML` под пользователем.

---

## 1. Зависимости

Добавить в `Hay Travel/Frontend/package.json` (`dependencies`), версии — точно эти минорные:

```
"@tiptap/react": "^3.30.2",
"@tiptap/core": "^3.30.2",
"@tiptap/pm": "^3.30.2",
"@tiptap/starter-kit": "^3.30.2",
"@tiptap/extension-text-style": "^3.30.2",
"@tiptap/extension-text-align": "^3.30.2",
"@tiptap/extension-image": "^3.30.2"
```

`@tiptap/core` и `@tiptap/pm` приходят транзитивно, но мы импортируем из них напрямую
(`Extension`, `mergeAttributes`, `@tiptap/pm/state`, `@tiptap/pm/view`) — поэтому они прописаны
явно.

Пакеты, которые НЕ ставим и не используем: `@tiptap/extension-font-size` (существует только как
`3.0.0-next` — вместо него своё расширение, см. §3.4), `@tiptap/extension-color` (покрывается тем
же своим расширением), `@tiptap/extension-placeholder` (пустое состояние делаем оверлеем, §3.9),
любые `@tiptap-pro/*`, любые сторонние color-picker-библиотеки (§3.10 обходится нативным
`<input type="color">`).

После установки: `npm run build` должен пройти; в выводе сборки убедиться, что чанки публичных
роутов (`home`/`tours`/`regions`) не выросли — Tiptap обязан оказаться только в админских чанках.

---

## 2. Дерево файлов

### Создать

| Путь | Что внутри |
| --- | --- |
| `Frontend/src/features/admin/ui/RichTextEditor/index.ts` | Барель: `RichTextEditor`, `RICH_TEXT_TOOLSETS`, типы `RichTextEditorProps`, `RichTextTool`, `RichTextPlaceholder`, `RichTextImageOptions`, `richTextContentClass` |
| `.../RichTextEditor/types.ts` | Типы и пресеты тулсетов (§3.1) |
| `.../RichTextEditor/RichTextEditor.tsx` | Container: `useEditor`, синхронизация `value`, `editable`, пустое состояние, рендер тулбара + `EditorContent` |
| `.../RichTextEditor/useRichTextEditorInstance.ts` | Хук: сборка расширений по `toolset`, создание `Editor`, синхронизация `value`/`disabled` (§3.2) |
| `.../RichTextEditor/RichTextToolbar.tsx` | Презентационный тулбар: кнопки/селекты, получает `editor` и `toolset` (§3.3) |
| `.../RichTextEditor/LinkDialog.tsx` | Поповер вставки/правки ссылки (§3.5) |
| `.../RichTextEditor/PlaceholderMenu.tsx` | Меню «Вставить поле» с человеческими названиями (§3.6) |
| `.../RichTextEditor/ColorPicker.tsx` | Свободный выбор цвета: нативный `<input type="color">` + быстрые образцы + hex-поле (§3.10) |
| `.../RichTextEditor/ImageDialog.tsx` | Вставка картинки: загрузка файла ИЛИ внешний URL (§3.11) |
| `.../RichTextEditor/extensions/TextStyleAttributes.ts` | `color` + `fontSize` как атрибуты марки `textStyle` (§3.4) |
| `.../RichTextEditor/extensions/PlaceholderHighlight.ts` | ProseMirror-плагин подсветки `{{Token}}` (§3.6) |
| `.../RichTextEditor/extensions/RichImage.ts` | `Image` с жёстко ограниченным набором атрибутов `src/alt/width` (§3.11) |
| `.../RichTextEditor/lib/richTextHtml.ts` | `editorHtml`, `isEmptyHtml`, `normalizeLinkHref` (§3.7) |
| `.../RichTextEditor/lib/color.ts` | `toHexColor`, `normalizeHexInput` (§3.10) |
| `.../RichTextEditor/lib/richTextContentClass.ts` | Общая строка Tailwind-классов для отображения rich-контента (§3.8) |
| `Frontend/src/features/admin/notifications/lib/placeholderLabels.ts` | Словарь `token → { label, hint }` (§4.2) |
| `Frontend/src/features/admin/ui/imageUploadValidation.ts` | `validateImageFile(file): string | null` — вынесенная из `useImageUpload` проверка типа/размера (§3.11) |

### Изменить

| Путь | Что именно |
| --- | --- |
| `Frontend/package.json` | Зависимости из §1 |
| `Frontend/src/features/admin/ui/useImageUpload.ts` | Убрать локальные `MAX_FILE_SIZE_BYTES`/`ALLOWED_TYPES`/`validationError`, звать `validateImageFile` из нового `imageUploadValidation.ts`. Публичный API хука не меняется |
| `Frontend/src/features/admin/notifications/components/EmailTemplateCard.tsx` | Импорт нового редактора, новый вид пропа `placeholders`, `toolset={RICH_TEXT_TOOLSETS.email}`, `image` (§4.1) |
| `Frontend/src/features/admin/notifications/lib/notificationsCopy.ts` | +`bodyPlaceholder` (§4.1) |

### Удалить

| Путь | Почему |
| --- | --- |
| `Frontend/src/features/admin/notifications/components/RichTextEditor.tsx` | Полностью заменяется; других импортов у него нет (проверено — только `EmailTemplateCard`) |

Барелей у `features/admin/ui/` нет (`TranslationGroup`/`ImageUrlField` импортируются по прямому
пути) — новый компонент импортируется как `@/features/admin/ui/RichTextEditor`.

---

## 3. Контракты

### 3.1. `types.ts`

```ts
/** Один инструмент тулбара. Он же включает соответствующий узел/марку в СХЕМЕ документа:
 *  чего нет в toolset — того не может появиться в документе даже через вставку из буфера. */
export type RichTextTool =
  | 'bold' | 'italic' | 'underline' | 'strike'
  | 'heading' | 'bulletList' | 'orderedList' | 'blockquote'
  | 'link' | 'color' | 'fontSize' | 'align' | 'image' | 'undo'

export interface RichTextPlaceholder {
  /** Уже в фигурных скобках, как отдаёт бэкенд: `{{OrderNumber}}`. */
  token: string
  /** Человеческое название для меню: «Номер заказа». */
  label: string
  /** Пояснение под названием, опционально. */
  hint?: string
}

export interface RichTextImageOptions {
  /** Загружает файл и отдаёт URL для вставки. По умолчанию — админский `api/Upload/Image`
   *  (см. §3.11). Проп существует, чтобы способ загрузки можно было подменить и чтобы
   *  компонент можно было унести в `shared/ui` без переписывания. */
  upload?: (file: File) => Promise<string>
  /** Разрешить вставку внешней ссылки на картинку вместо загрузки файла. По умолчанию `true`
   *  — та же двойственность, что у `ImageUrlField` (ADR 2026-08-15). */
  allowExternalUrl?: boolean
}

export interface RichTextEditorProps {
  /** HTML (санитизированный сервером или собственная несохранённая правка). Пустое значение — `''`. */
  value: string
  /** Вызывается на каждое изменение документа. Пустой документ отдаётся как `''`, НЕ как `<p></p>`. */
  onChange: (html: string) => void
  disabled?: boolean
  /** Набор инструментов И схема документа. По умолчанию `RICH_TEXT_TOOLSETS.minimal`. */
  toolset?: readonly RichTextTool[]
  /** Пусто/не передано — кнопки «Вставить поле» нет, расширение подсветки не подключается. */
  placeholders?: readonly RichTextPlaceholder[]
  /** Настройки картинок. Игнорируется, если в `toolset` нет `'image'`. */
  image?: RichTextImageOptions
  /** Текст-подсказка в пустом редакторе. */
  placeholder?: string
  /** Минимальная высота поля ввода. По умолчанию `'md'`. */
  minHeight?: 'sm' | 'md' | 'lg'
  /** Красная рамка; текст ошибки рисует вызывающая сторона (как у `Input`/`Select`). */
  invalid?: boolean
  'aria-label'?: string
  id?: string
  className?: string
}

export const RICH_TEXT_TOOLSETS = {
  /** Тело email-шаблона. Полный набор в пределах allow-list §E.5 — Давид подтвердил
   *  2026-08-22, что нужны и заголовки, и выравнивание, и картинки. */
  email: [
    'bold', 'italic', 'underline', 'link',
    'heading', 'fontSize', 'color', 'align',
    'bulletList', 'orderedList', 'image', 'undo',
  ],
  /** Описания туров/дней (фаза 2). Без color/fontSize намеренно: типографику публичного
   *  сайта задаёт дизайн-система, а не контент (ADR 023). */
  description: ['bold', 'italic', 'underline', 'link', 'heading', 'bulletList', 'orderedList', 'blockquote', 'align', 'image', 'undo'],
  /** Короткое поле: только выделение и ссылка. */
  minimal: ['bold', 'italic', 'link', 'undo'],
} as const satisfies Record<string, readonly RichTextTool[]>
```

### 3.2. `useRichTextEditorInstance.ts`

Сигнатура:

```ts
interface UseRichTextEditorInstanceArgs {
  value: string
  onChange: (html: string) => void
  disabled: boolean
  toolset: readonly RichTextTool[]
  hasPlaceholders: boolean
  ariaLabel?: string
}
export function useRichTextEditorInstance(args: UseRichTextEditorInstanceArgs): Editor | null
```

Внутри:

1. **Сборка расширений** — чистая функция `buildExtensions(toolset, hasPlaceholders): Extensions`
   в том же файле:

   ```ts
   StarterKit.configure({
     // Не в allow-list §E.5. `<pre>` санитайзер удаляет ВМЕСТЕ с содержимым — тихая потеря текста.
     code: false, codeBlock: false, horizontalRule: false,
     bold:       has('bold') && {},        // `false` когда инструмента нет
     italic:     has('italic') && {},
     underline:  has('underline') && {},
     strike:     has('strike') && {},
     blockquote: has('blockquote') && {},
     bulletList: has('bulletList') && {},
     orderedList: has('orderedList') && {},
     heading: has('heading') ? { levels: [1, 2, 3] } : false,
     link: has('link') ? {
       openOnClick: false,
       autolink: true,
       protocols: ['http', 'https', 'mailto'],   // совпадает с AllowedSchemes бэкенда
       HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
     } : false,
   })
   ```
   `listItem`, `paragraph`, `text`, `document`, `hardBreak`, `dropcursor`, `gapcursor`,
   undo/redo остаются включёнными всегда (дефолт StarterKit).

   Дополнительно:
   - `TextStyle` + `TextStyleAttributes` — если в toolset есть `color` **или** `fontSize`;
   - `TextAlign.configure({ types: ['heading', 'paragraph'] })` — если есть `align`;
   - `RichImage` (§3.11) — если есть `image`;
   - `PlaceholderHighlight` — если `hasPlaceholders`.

   Массив расширений мемоизировать (`useMemo` по `toolset.join('|') + hasPlaceholders`), иначе
   `useEditor` будет пересоздавать редактор.

2. **Создание редактора:**

   ```ts
   const editor = useEditor({
     extensions,
     content: value || '',
     editable: !disabled,
     editorProps: {
       attributes: {
         class: `${richTextContentClass} outline-none px-3 py-2.5 text-sm text-neutral-900`,
         role: 'textbox',
         'aria-multiline': 'true',
         ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
       },
     },
     onUpdate: ({ editor }) => {
       const html = editorHtml(editor)
       lastEmittedRef.current = html
       onChangeRef.current(html)
     },
   }, [extensions])
   ```
   `onChange` держать в ref (`onChangeRef.current = onChange` в `useEffect`), чтобы новая
   лямбда из родителя не пересоздавала редактор.

3. **Синхронизация внешнего `value` — самая важная часть, здесь жил баг 1:**

   ```ts
   const lastEmittedRef = useRef(value)
   useEffect(() => {
     if (!editor || value === lastEmittedRef.current) return
     lastEmittedRef.current = value
     editor.commands.setContent(value || '', { emitUpdate: false })
   }, [editor, value])
   ```
   Требование, а не деталь реализации: команда **не должна** порождать `onUpdate`, иначе
   получим цикл. (Сигнатура опций — Tiptap v3; если установленные `.d.ts` расходятся, взять
   форму из них, но поведение оставить это.)

4. **`disabled`:** `useEffect(() => editor?.setEditable(!disabled), [editor, disabled])`.

5. Ничего похожего на `savedRange`/`focusAndRestoreSelection` в новом коде быть не должно.
   Все команды тулбара — только через `editor.chain().focus()....run()`.

### 3.3. `RichTextToolbar.tsx`

Пропы: `{ editor: Editor; toolset: readonly RichTextTool[]; disabled: boolean; placeholders?: readonly RichTextPlaceholder[]; image?: RichTextImageOptions }`.
Чисто презентационный — знает `editor`, не знает ни про email, ни про туры.

- Контейнер: `flex flex-wrap items-center gap-1.5 border-b border-neutral-200 p-1.5`; на узком
  экране — горизонтальная прокрутка вместо переноса в 4 ряда: добавить
  `max-sm:flex-nowrap max-sm:overflow-x-auto`.
- Инструментов теперь 12 — сгруппировать разделителями (`<span className="mx-1 h-6 w-px bg-neutral-200" aria-hidden />`)
  в порядке: **текст** (bold/italic/underline) · **блок** (heading, align, списки) ·
  **оформление** (fontSize, color) · **вставка** (link, image) · **undo/redo** ·
  **плейсхолдеры** (прижаты вправо, `ml-auto`).
- `onMouseDown={(e) => e.preventDefault()}` на контейнере **оставить** (не даёт кнопке украсть
  фокус и не даёт мигать выделению). Теперь это косметика, а не несущая конструкция.
- Кнопки-переключатели (`bold/italic/underline/strike/bulletList/orderedList/blockquote`):
  `onClick={() => editor.chain().focus().toggleBold().run()}`, активность —
  `editor.isActive('bold')`, `aria-pressed` от неё же. Перерисовка на смену выделения:
  обернуть тулбар в `EditorContext`-подписку через `useEditorState` из `@tiptap/react`
  (или, если проще, локальный `useState`-форс по `editor.on('transaction')` с отпиской) —
  главное, чтобы подсветка кнопок обновлялась при переносе курсора.
- Стиль кнопки — перенести один в один из старого `toolbarButtonClass` (строки 30–36 удаляемого
  файла), включая `disabled:` состояния. Минимальный тап-таргет на мобильном: у кнопки должен
  быть `min-h-8` и `min-w-8`, как сейчас.
- `heading`: `Select` (`@/shared/ui`, `surface="admin"`) со значениями `''` (Обычный текст),
  `'1'` (Заголовок 1), `'2'`, `'3'`; применение — `toggleHeading({ level })` / `setParagraph()`.
  Текущее значение — из `editor.getAttributes('heading').level ?? ''`.
- `fontSize`: `Select`, опции `Обычный ('')`, `Мелкий ('12px')`, `Крупный ('20px')`,
  `Очень крупный ('28px')` — те же значения, что сейчас. `value` берётся из
  `editor.getAttributes('textStyle').fontSize ?? ''`; применение — `setFontSize(v)` /
  `unsetFontSize()` при `''`.
- `color`: **не `Select`**, а `ColorPicker` (§3.10) — свободный выбор цвета.
- `align`: три кнопки (лево/центр/право), `setTextAlign('left'|'center'|'right')`,
  активность — `editor.isActive({ textAlign: 'center' })`.
- `undo`: две кнопки undo/redo, `editor.can().undo()` → `disabled`.
- `link`: кнопка открывает `LinkDialog` (§3.5).
- `image`: кнопка открывает `ImageDialog` (§3.11). Рендерится только если `'image'` в toolset.
- `placeholders`: `PlaceholderMenu` (§3.6).

`Select` уже сам переключается на `Sheet` на компактном вьюпорте — отдельной мобильной ветки
для селектов писать не нужно.

### 3.4. `extensions/TextStyleAttributes.ts`

Одно расширение вместо двух пакетов; полностью контролирует форму вывода
(`<span style="font-size: 20px">`, `<span style="color: #b91c1c">`), которая и разрешена в §E.5.

```ts
import { Extension } from '@tiptap/core'
import { toHexColor } from '../lib/color'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    richTextStyle: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
      setTextColor: (color: string) => ReturnType
      unsetTextColor: () => ReturnType
    }
  }
}

export const TextStyleAttributes = Extension.create({
  name: 'textStyleAttributes',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
        },
        color: {
          default: null,
          // ВАЖНО: `el.style.color` браузер отдаёт в виде `rgb(185, 28, 28)`, а не `#b91c1c`.
          // Без нормализации мы бы сохранили `rgb(...)`, который бэкенд-валидация цвета
          // (спека 012) обязана либо принимать, либо резать — а резала бы она молча.
          parseHTML: (el: HTMLElement) => toHexColor(el.style.color),
          renderHTML: (attrs) => (attrs.color ? { style: `color: ${attrs.color}` } : {}),
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
      // На вход всегда нормализованный `#rrggbb` — нормализует вызывающий `ColorPicker`.
      setTextColor: (color) => ({ chain }) => chain().setMark('textStyle', { color }).run(),
      unsetTextColor: () => ({ chain }) => chain().setMark('textStyle', { color: null }).removeEmptyTextStyle().run(),
    }
  },
})
```

Требует включённого `TextStyle` из `@tiptap/extension-text-style` (импорт `{ TextStyle }`).
Два `style`-фрагмента от двух атрибутов Tiptap склеивает сам (`mergeAttributes` объединяет
`style`) — **именно это и чинит баг 1**: цвет и размер живут в одной марке и не вытесняют
друг друга.

### 3.5. `LinkDialog.tsx`

Пропы: `{ editor: Editor; open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLElement | null> }`.
Построен на `Popover` из `@/shared/ui` (он не забирает фокус — состояние выделения ProseMirror
переживает открытие).

Поведение:

- Открытие: если курсор внутри ссылки — поле предзаполняется `editor.getAttributes('link').href`,
  показывается вторая кнопка «Удалить ссылку» (`unsetLink()`).
- Применение при непустом выделении:
  `editor.chain().focus().extendMarkRange('link').setLink({ href }).run()`.
- Применение при схлопнутом курсоре: вставить сам URL текстом и сразу сделать его ссылкой —
  `editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()`.
  Тупика «нечего выделять» быть не должно (сейчас кнопка молча ничего не делает).
- Валидация — `normalizeLinkHref` (§3.7). Ошибка показывается прямо в поповере, поповер не
  закрывается. `window.prompt` из старой реализации не использовать.
- Enter в поле = применить, Escape = закрыть (Escape уже обрабатывает `Popover`).

### 3.6. Плейсхолдеры

**`PlaceholderMenu.tsx`** — пропы `{ items: readonly RichTextPlaceholder[]; disabled: boolean; onInsert: (token: string) => void }`.
Своё меню на `Popover` + `Sheet` (через `useIsCompactViewport` из `@/shared/hooks`, как это
делает `DatePicker`), а не `ActionsMenu`: пункт должен быть двухстрочным (название + сам токен
мелким моноширинным + `hint`), а `ActionsMenuItem.label` — просто строка.

- Триггер: кнопка с текстом «Вставить поле» (не «Вставить…»), `aria-haspopup="menu"`.
- Пункт: жирным `label`, ниже `<code className="text-[11px] text-neutral-400">{token}</code>`,
  ещё ниже `hint`, если есть.
- Клик: `onInsert(token)` и закрыть меню.

Вставка в `RichTextToolbar`:
`editor.chain().focus().insertContent({ type: 'text', text: token }).run()` — именно объектом
`{type:'text'}`, не строкой: строку Tiptap парсит как HTML.

**`extensions/PlaceholderHighlight.ts`** — подсветка уже вставленных токенов, чтобы владелец
видел их как «пилюли», а не как непонятные скобки:

```ts
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const TOKEN_RE = /\{\{[A-Za-z0-9_]+\}\}/g
export const PlaceholderHighlight = Extension.create({
  name: 'placeholderHighlight',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('placeholderHighlight'),
      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return
            for (const m of node.text.matchAll(TOKEN_RE)) {
              const from = pos + (m.index ?? 0)
              decorations.push(Decoration.inline(from, from + m[0].length, {
                class: 'rounded bg-neutral-900/5 px-1 font-semibold text-neutral-700 ring-1 ring-neutral-900/10',
              }))
            }
          })
          return DecorationSet.create(state.doc, decorations)
        },
      },
    })]
  },
})
```

Декорация существует только в редакторе: `getHTML()` её не содержит, в БД по-прежнему уходит
чистый текст `{{OrderNumber}}`, регулярка рендерера писем (`\{\{(?<token>[A-Za-z0-9_]+)\}\}`)
продолжает работать. Формат хранения не меняется — миграции контента нет.

### 3.7. `lib/richTextHtml.ts`

```ts
/** HTML документа; ПУСТОЙ документ отдаётся как `''`, а не как `<p></p>` — иначе
 *  «грязность» формы (`EmailTemplateCard.isDirty`) и проверки на обязательность врут.
 *  Документ, в котором есть только картинка, пустым НЕ считается (`editor.isEmpty` смотрит
 *  на текст — проверить и, если нужно, дополнить условием на наличие узлов `image`). */
export function editorHtml(editor: Editor): string

/** Пустой ли сохранённый HTML: пусто, только пробелы, `<p></p>`, `<p><br></p>`. */
export function isEmptyHtml(html: string): boolean

/** `example.com` → `https://example.com`; `http(s)://`/`mailto:` пропускает как есть;
 *  всё остальное (в частности `javascript:`, `data:`) → `null`. Схемы совпадают с
 *  AllowedSchemes бэкенда (§E.5). */
export function normalizeLinkHref(input: string): string | null
```

### 3.8. `lib/richTextContentClass.ts`

Одна экспортируемая строка Tailwind-классов для ОТОБРАЖЕНИЯ rich-контента (в проекте нет
`@tailwindcss/typography`, а Preflight сбрасывает списки и заголовки — без этого маркеры и
кегли не видны прямо в редакторе):

```ts
export const richTextContentClass = [
  '[&_p]:my-1',
  '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-xl [&_h1]:font-bold',
  '[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-bold',
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600',
  '[&_a]:text-blue-700 [&_a]:underline',
  // `max-w-full` перебивает HTML-атрибут `width` у картинки: атрибут нужен письму
  // (почтовые клиенты игнорируют CSS), CSS нужен вебу, конфликта нет — CSS сильнее.
  '[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_img.ProseMirror-selectednode]:outline [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-neutral-900',
].join(' ')
```

Экспортируется из бареля — в фазе 2 её же переиспользует публичный рендерер.

### 3.9. `RichTextEditor.tsx` (container)

- Рамка/фон — как сейчас: `rounded-lg border`, `border-neutral-300 bg-white`, при `disabled` —
  `border-neutral-200 bg-neutral-50`. При `invalid` — красная рамка, как у `Input` с `error`.
- `minHeight`: `sm` → `min-h-24`, `md` → `min-h-32` (как сейчас), `lg` → `min-h-64`.
- `EditorContent` в обёртке с `overflow-auto` и `max-w-full`.
- Пустое состояние: когда `editor.isEmpty && placeholder`, поверх области ввода абсолютно
  спозиционированная подсказка `pointer-events-none select-none text-sm text-neutral-400`
  с тем же паддингом, что и контент. Отдельного пакета `extension-placeholder` не заводить.
- Пока `editor === null` (первый рендер) — отрисовать ту же рамку с пустой областью, без
  скачка высоты.
- `id` вешать на внешний контейнер, чтобы `<label htmlFor>` работал.

### 3.10. `ColorPicker.tsx` + `lib/color.ts` (свободный цвет)

Давид попросил свободный выбор цвета вместо пяти фиксированных. Сторонняя библиотека не нужна:
нативный `<input type="color">` даёт системную палитру-«капельницу» и уже возвращает строго
`#rrggbb` в нижнем регистре.

Пропы: `{ editor: Editor; disabled: boolean }`.

- Триггер — кнопка размера остальных кнопок тулбара с кружком текущего цвета внутри
  (`editor.getAttributes('textStyle').color ?? '#0a0a0a'`), `aria-label="Цвет текста"`.
- Панель — `Popover` (на компактном вьюпорте `Sheet`, как в §3.6), внутри:
  1. `<input type="color">` — свободный выбор; применение на `onChange` (живое превью
     допустимо, но каждый шаг не должен плодить отдельную запись undo — применять по
     `onBlur`/закрытию панели, либо на `onInput` с `chain().setMark(...)`, что Tiptap схлопнет
     в одну транзакцию при одинаковой позиции).
  2. Быстрые образцы — те же 5 цветов, что были (`#0a0a0a` Чёрный, `#b91c1c` Красный,
     `#15803d` Зелёный, `#1d4ed8` Синий, `#a16207` Золотой): круглые кнопки с `title`/`aria-label`
     по названию. Это не ограничение палитры, а ускорение частых случаев.
  3. Текстовое поле hex (`placeholder="#1d4ed8"`, `maxLength={7}`, `spellCheck={false}`) —
     чтобы можно было вставить цвет из брендбука копипастой. Валидация — `normalizeHexInput`.
  4. Кнопка «По умолчанию» → `unsetTextColor()` и закрыть панель.
- Применение: `editor.chain().focus().setTextColor(hex).run()`, где `hex` — всегда результат
  нормализации.

`lib/color.ts`:

```ts
/** Любое CSS-значение цвета из DOM → `#rrggbb` в нижнем регистре, либо `null`.
 *  Обязан понимать как минимум: `#rgb`, `#rrggbb`, `rgb(r, g, b)`, `rgba(r, g, b, a)`
 *  (альфа отбрасывается — в allow-list её всё равно нет). Всё остальное (`var(...)`,
 *  `color-mix(...)`, именованные цвета, `url(...)`) → `null`: контракт с бэкендом —
 *  строго 6-значный hex (спека 012, §В). */
export function toHexColor(input: string | null | undefined): string | null

/** То же для пользовательского ввода: обрезает пробелы, дописывает `#`, разворачивает
 *  3-значную форму в 6-значную. Невалидное → `null` (поле показывает ошибку). */
export function normalizeHexInput(input: string): string | null
```

### 3.11. Картинки: `extensions/RichImage.ts` + `ImageDialog.tsx`

Аплоад **переиспользуется, а не пишется заново**. Существующая цепочка (проверена по коду):
`features/admin/api/uploads.ts` → `uploadImage(file): Promise<{ url }>` → `POST api/Upload/Image`
(`FormData`, поле `file`, через `authFetch`); бэкенд возвращает ОТНОСИТЕЛЬНЫЙ URL вида
`/uploads/<подкаталог>/<имя>.<ext>` (`UploadSettings.PublicUrlPrefix`). Клиентская валидация
(JPEG/PNG/WebP, ≤ 8 МБ) сейчас лежит внутри `features/admin/ui/useImageUpload.ts` — вынести её в
`features/admin/ui/imageUploadValidation.ts` (`validateImageFile(file): string | null`) и звать из
обоих мест. Дублировать лимиты запрещено.

**`extensions/RichImage.ts`:**

```ts
import Image from '@tiptap/extension-image'

/** Блочная картинка со СТРОГО тремя атрибутами. Ничего лишнего — `style`, `class`, `srcset`,
 *  `loading`, `data-*` не пройдут санитайзер (спека 012) и были бы молча срезаны при
 *  сохранении. `allowBase64: false` — data:-URL в письме весит как само письмо и режется
 *  почти всеми клиентами. */
export const RichImage = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      // Ширина в пикселях, БЕЗ единиц — HTML-атрибут `width`, а не CSS. Это единственный
      // способ управлять размером картинки в письме: Outlook и Gmail игнорируют `max-width`.
      // На вебе его перебивает `[&_img]:max-w-full` из `richTextContentClass` (§3.8).
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('width'),
        renderHTML: (attrs) => (attrs.width ? { width: String(attrs.width) } : {}),
      },
    }
  },
}).configure({ inline: false, allowBase64: false })
```

**`ImageDialog.tsx`** — пропы
`{ editor: Editor; open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLElement | null>; options: RichTextImageOptions }`.
На `Popover`/`Sheet`, как остальные панели тулбара. Два пути к одному результату — тот же
дуализм, что у `ImageUrlField` (ADR 2026-08-15):

1. **Загрузить файл** — скрытый `<input type="file" accept="image/jpeg,image/png,image/webp">`
   + видимая кнопка (разметку взять с `ImageUploadButton`, сам компонент не переиспользуем:
   он рисует свою обёртку и своё сообщение об ошибке, а нам нужно вписать это в панель).
   Порядок: `validateImageFile(file)` → при ошибке показать её в панели и не грузить →
   `options.upload?.(file) ?? uploadImage(file).then(r => r.url)`.
2. **Ссылка на картинку** (если `options.allowExternalUrl !== false`) — поле URL; принимаем
   только `http(s)://…` и пути, начинающиеся с `/uploads/` (тот же `normalizeLinkHref`, но со
   схемами без `mailto` — сделать отдельный `normalizeImageSrc` в `lib/richTextHtml.ts`).
   `javascript:`/`data:` не принимаем.

Дальше оба пути сходятся:

- поле «Описание (alt)» — необязательное, но с подсказкой «покажется, если картинка не
  загрузится; важно для писем — многие клиенты не показывают картинки по умолчанию»;
- вычислить `width`: загрузить `new Image()` по полученному `src`, взять
  `Math.min(naturalWidth, 600)` (600 px — ширина тела типичного письма). Если картинка не
  загрузилась за таймаут или отдала 0 — вставлять БЕЗ атрибута `width`, не блокируя вставку;
- `editor.chain().focus().setImage({ src, alt, width }).run()`, закрыть панель, сбросить
  состояние панели.

**URL сохраняем как отдал бэкенд — относительным.** Не абсолютизируем на фронте: захардкоженный
в контенте домен сломается при смене домена, а на публичном сайте (фаза 2) относительный путь
как раз корректен. Абсолютный URL для письма собирает бэкенд в момент отправки — это пункт (б)
спеки 010.

Состояния панели: `idle` / `uploading` (спиннер в кнопке, кнопки заблокированы) / ошибка
валидации файла / ошибка сети («Не удалось загрузить файл.») / ошибка URL / успех → вставка и
закрытие.

---

## 4. Переезд `EmailTemplateCard`

### 4.1. Изменения в `EmailTemplateCard.tsx`

Только блок тела письма (строки 98–112). Остальное (draft/dirty/pending/save) не трогать.

```tsx
import { RICH_TEXT_TOOLSETS, RichTextEditor } from '@/features/admin/ui/RichTextEditor'
import { placeholderItems } from '../lib/placeholderLabels'

const placeholders = useMemo(
  () => placeholderItems(template.availablePlaceholders),
  [template.availablePlaceholders],
)

<RichTextEditor
  value={draft.bodyHtml}
  onChange={(bodyHtml) => { setJustSaved(false); setDraft((p) => ({ ...p, bodyHtml })) }}
  toolset={RICH_TEXT_TOOLSETS.email}
  placeholders={placeholders}
  placeholder={notificationsCopy.bodyPlaceholder}
  minHeight="md"
  aria-label={`${notificationsCopy.bodyLabel}: ${template.displayName}`}
/>
```

Проп `image` не передаётся — берётся дефолт (`api/Upload/Image` + разрешённый внешний URL).

`notificationsCopy.bodyPlaceholder` — новая строка в
`features/admin/notifications/lib/notificationsCopy.ts`: `'Текст письма. Вставьте нужные поля через «Вставить поле».'`

Поведенческий контракт после переезда:

- Тулбар не беднее прежнего (жирный/курсив/подчёркнутый/ссылка/размер/цвет) и прибавляет
  заголовки, выравнивание, списки, картинки, undo/redo.
- `bodyHtml` уходит на PUT в том же виде; **новые теги (`img`) требуют выполненной спеки 010** — см. §9.
- Плейсхолдеры хранятся как раньше — обычный текст `{{Token}}`.

### 4.2. `notifications/lib/placeholderLabels.ts`

Живёт в фиче, а не в редакторе: это доменное знание про письма заказов, редактор про них знать
не должен.

```ts
const LABELS: Record<string, { label: string; hint?: string }> = {
  OrderNumber:       { label: 'Номер заказа',         hint: 'Например, 240816-0007' },
  TourTitle:         { label: 'Название тура' },
  TourDate:          { label: 'Дата тура' },
  GuestCount:        { label: 'Количество гостей' },
  ClientName:        { label: 'Имя клиента' },
  ClientEmail:       { label: 'Email клиента' },
  EmployeeName:      { label: 'Имя исполнителя' },
  EmployeeRole:      { label: 'Роль исполнителя',      hint: 'Гид, водитель и т.д.' },
  AssignmentDetails: { label: 'Детали назначения',     hint: 'Список позиций заказа — бэкенд собирает его сам' },
}

/** `['{{OrderNumber}}', …]` (как отдаёт `EmailTemplateInfoModel.availablePlaceholders`)
 *  → пункты меню. Неизвестный токен показывается как есть, а не прячется. */
export function placeholderItems(tokens: readonly string[]): RichTextPlaceholder[]
```

Состав токенов и их смысл сверены с `ATTours.Common/Constants/EmailPlaceholders.cs`. Если там
появится новый токен, а тут его не будет, — пункт всё равно отрисуется с сырым названием, ничего
не сломается.

---

## 5. Состояния и edge-кейсы (обязательны к реализации)

| Кейс | Ожидаемое поведение |
| --- | --- |
| Выделили текст мышью → «Ж» | Жирность применяется к выделению; выделение сохраняется (баг 2) |
| Размер → затем цвет на том же выделении | Обе стилизации на месте, вторая не сбрасывает первую (баг 1) |
| Цвет → «По умолчанию» | Атрибут снимается, `<span>` не остаётся пустым (`removeEmptyTextStyle`) |
| Цвет выбран, страница перезагружена | Цвет тот же: `rgb(…)` из DOM нормализуется обратно в `#rrggbb` (§3.4) |
| В hex-поле введено `#абв` / `red` / `#12345` | Поле показывает ошибку, цвет не применяется |
| В hex-поле введено `1d4ed8` или `#1D4ED8` | Нормализуется в `#1d4ed8`, применяется |
| Пустой документ | `onChange('')`, а не `'<p></p>'`; видна подсказка `placeholder` |
| Документ только из картинки | НЕ считается пустым, `onChange` отдаёт HTML с `<img>` |
| `disabled` | Ввод запрещён, все кнопки тулбара `disabled`, фон серый |
| Сервер вернул отсанитизированный HTML | Родитель обновляет `value` только когда форма не «грязная»; редактор перезаписывает контент без `onUpdate` |
| Ссылка: пустое выделение | URL вставляется текстом и сразу становится ссылкой |
| Ссылка: `javascript:alert(1)` | Ошибка в поповере «Ссылка должна начинаться с http://, https:// или mailto:», ничего не вставляется |
| Ссылка: `example.com` | Нормализуется в `https://example.com` |
| Картинка: файл 20 МБ или `.gif` | Сообщение из `validateImageFile`, запрос на сервер не уходит |
| Картинка: аплоад упал (сеть/500) | «Не удалось загрузить файл.», панель открыта, состояние `uploading` снято |
| Картинка: внешний URL с `data:`/`javascript:` | Отклоняется с ошибкой в панели |
| Картинка: вставлена | `<img src alt width>` без `style`/`class`; ширина ≤ 600; на узком экране не вылезает за поле |
| Картинка выделена в редакторе | Видна рамка выделения; Delete/Backspace удаляют её |
| Вставка (Ctrl+V) из Word/почты | Всё, чего нет в схеме, отбрасывается на месте — сохранение не должно «съедать текст» задним числом |
| Ctrl+Z после применения стиля/вставки картинки | Отменяет действие (через undo/redo Tiptap, не системный) |
| Узкий экран (≤480 px) | Тулбар прокручивается горизонтально, кнопки не мельче 32 px, `Select`/панели открываются как `Sheet` |
| Неизвестный плейсхолдер из бэкенда | Пункт меню с сырым токеном вместо названия |

---

## 6. Вне скоупа фазы 1 (не реализовывать)

- **Подключение редактора к описаниям туров/дней** — `TourFormHeader.tsx`, `TourDayFields.tsx`,
  `TranslationGroup` остаются на `Textarea` (фаза 2, §7).
- Любые изменения бэкенда: allow-list, санитайзер, миграции, DTO, абсолютизация URL. Это
  отдельная спека 012 и зона `backend-architect` — фронтенд-исполнитель бэкенд не трогает.
- Публичный рендерер rich-контента (`shared/ui/RichText`).
- Ресайз картинки мышкой за уголок, обтекание текстом, подписи (`figure/figcaption` — тега нет
  в allow-list), галереи.
- Таблицы, шрифтовые семейства, фоновая заливка текста, эмодзи-пикер, markdown-shortcuts сверх
  дефолтных, история версий, автосохранение.
- Перенос редактора в `shared/ui` (см. escape hatch в ADR 023 — понадобится только если
  редактирование выйдет за пределы `/admin`).

---

## 7. Фаза 2 — описания туров (проектное решение принято; отдельная задача, отдельная спека)

Порядок обязателен: бэкенд → публичный рендер → форма тура. Иначе получаем хранимый XSS на
публичном сайте (сегодня описания тура — обычный текст, санитайзера у них нет вообще).

1. **Бэкенд.** Профиль `RichContent` санитайзера (спека 012, §А) применяется к
   `Tour.Description`/`ShortDescription` и описаниям дней при сохранении.
2. **Публичный рендер.** `shared/ui/RichText` — единственное место во всём проекте, где
   допускается `dangerouslySetInnerHTML` (сегодня его нет нигде), плюс `richTextContentClass`
   в палитре публичной темы. Старые значения описаний — обычный текст с переводами строк:
   при чтении прогонять через `plainTextToHtml(value)` (если в строке нет `<`, разбить по
   `\n\n` в `<p>` и по `\n` в `<br>`), иначе переносы строк пропадут.
3. **Форма тура.** `TranslationGroup` получает проп `control?: 'input' | 'textarea' | 'rich'`
   (по умолчанию текущее поведение), `TourFormHeader`/`TourDayFields` переводят
   `Description`/`ShortDescription` на `control="rich"` с `RICH_TEXT_TOOLSETS.description`.
   `Title` и `Duration` остаются `Input` — форматирование там не нужно.

---

## 8. Решения Давида (2026-08-22) — бывшие открытые вопросы

Все три закрыты, спека выше уже переписана под них:

1. **Картинки в теле письма — нужны.** Перенесены из фазы 2 в фазу 1: `'image'` в
   `RICH_TEXT_TOOLSETS.email`, §3.11. Требует пунктов (а) и (б) спеки 010 на бэкенде.
2. **Заголовки и выравнивание в письмах — добавить.** `'heading'` и `'align'` в
   `RICH_TEXT_TOOLSETS.email`; allow-list §E.5 их уже разрешает (`h1–h3`, `text-align`),
   изменений бэкенда для них НЕ требуется.
3. **Свободный выбор цвета вместо пяти образцов.** §3.10; пять прежних цветов остаются как
   быстрые кнопки внутри панели. Требует пункта (в) спеки 010 — валидации hex на бэкенде.

---

## 9. Зависимость от бэкенда — порядок работ

Пункты 2 (заголовки/выравнивание) и всё остальное из фазы 1 работают на текущем бэкенде без
единой правки. **Не работают без спеки 010 ровно две вещи:**

| Что | Что произойдёт без бэкенд-части |
| --- | --- |
| Картинка в письме | `img` нет в `AllowedTags`, `src` — в `AllowedAttributes`/`UriAttributes`. Картинка **молча исчезнет при сохранении**, и владелец увидит это только по факту. Плюс относительный `/uploads/...` не откроется ни в одном почтовом клиенте |
| Свободный hex-цвет | Значение `color` сейчас не валидируется — это дыра, которую мы сами расширяем, давая пользователю свободный ввод CSS-значения |

Поэтому:

- Спеку 010 забирает `backend-architect` и она должна быть **выполнена и выкачена не позже**
  фронтовой части. Порядок «сначала бэкенд, потом фронт» предпочтителен.
- Если бэкенд-часть по какой-то причине откладывается, фронт всё равно реализуется полностью,
  но выкат в прод не делается — иначе получаем ровно тот сценарий тихой потери данных, ради
  предотвращения которого картинки изначально были отложены (ADR 023).
- Приёмка фазы 1 включает сквозную проверку: вставить картинку в шаблон → сохранить →
  перезагрузить страницу (картинка на месте, `src` не пропал) → отправить тестовое письмо
  (картинка видна в почтовом клиенте, URL абсолютный).
