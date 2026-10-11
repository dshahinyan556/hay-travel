/**
 * Types and toolset presets for the shared admin rich-text editor (spec 011 §3.1).
 *
 * `toolset` is the ONE knob that decides both what the toolbar shows AND what the document
 * schema allows (`useRichTextEditorInstance.buildExtensions`): a tool that is not in the array
 * cannot produce its node/mark even via paste, because the extension that would register it is
 * never loaded. Keep every new tool wired through this one array — do not add a parallel boolean
 * prop for a feature, or the schema and the toolbar can drift apart.
 */

/** One toolbar instrument. It doubles as a document-schema switch — see the module doc above. */
export type RichTextTool =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'link'
  | 'color'
  /** Заливка текста (background-color), отдельно от `color` (Notification Templates,
   * 2026-08-31) — своя палитра-пикер, своя CSS-марка. */
  | 'highlight'
  | 'fontSize'
  /** Web-safe список из курируемого Select (Notification Templates, 2026-08-31) — не
   * произвольный ввод, чтобы шрифт реально дожил до email-клиента. */
  | 'fontFamily'
  | 'align'
  | 'image'
  /** Таблица (Notification Templates, 2026-08-31) — toolbar-кнопка со сеткой выбора
   * строк/столбцов, как в Word/Docs. */
  | 'table'
  /** Преформатированный текст/код (Notification Templates, 2026-08-31) — раньше был
   * отключён из-за бага санитайзера (`<pre>`/`<code>` не в allow-list, вырезались ВМЕСТЕ с
   * содержимым); allow-list починен, можно включать. */
  | 'code'
  | 'undo'

export interface RichTextPlaceholder {
  /** Already wrapped in `{{ }}`, exactly as the backend sends it: `{{OrderNumber}}`. */
  token: string
  /** Human-readable name for the menu: «Номер заказа». */
  label: string
  /** Optional caption under the name. */
  hint?: string
}

export interface RichTextImageOptions {
  /** Uploads a file and resolves to the URL to insert. Defaults to the admin's
   * `api/Upload/Image` (see `ImageDialog.tsx`). Exists so the upload mechanism can be swapped
   * out and so this component can move to `shared/ui` later without a rewrite (ADR 023). */
  upload?: (file: File) => Promise<string>
  /** Allow inserting an external image URL instead of uploading a file. Defaults to `true` —
   * the same duality `ImageUrlField` already offers (ADR 2026-08-15). */
  allowExternalUrl?: boolean
}

export interface RichTextEditorProps {
  /** HTML (sanitized by the server, or the visitor's own unsaved edit). Empty is `''`. */
  value: string
  /** Fires on every document change. An empty document is reported as `''`, never `'<p></p>'`. */
  onChange: (html: string) => void
  disabled?: boolean
  /** Tools shown AND the document schema they allow. Defaults to `RICH_TEXT_TOOLSETS.minimal`. */
  toolset?: readonly RichTextTool[]
  /** Empty/omitted — no "Вставить поле" button, no highlight extension attached. */
  placeholders?: readonly RichTextPlaceholder[]
  /** Image behaviour. Ignored when `'image'` is not in `toolset`. */
  image?: RichTextImageOptions
  /** Placeholder copy shown in the empty editor. */
  placeholder?: string
  /** Minimum height of the input area. Defaults to `'md'`. */
  minHeight?: 'sm' | 'md' | 'lg'
  /** Dark border (no red — see `Input`/`Select`'s `error` prop); the error text itself is the
   * caller's responsibility, same contract as `Input`/`Select`. */
  invalid?: boolean
  'aria-label'?: string
  id?: string
  className?: string
}

export const RICH_TEXT_TOOLSETS = {
  /** Notification Templates (2026-08-31), `channel === Email` — the fullest set the Email
   * sanitizer allow-list permits: everything `telegramLimited` has, plus font family/size,
   * colour + highlight, table, headings up to H6. Replaces the old narrower `email` preset. */
  full: [
    'bold', 'italic', 'underline', 'strike', 'code', 'link',
    'heading', 'blockquote', 'fontFamily', 'fontSize', 'color', 'highlight', 'align',
    'bulletList', 'orderedList', 'table', 'image', 'undo',
  ],
  /** Notification Templates (2026-08-31), `channel === Telegram` — ONLY what Telegram Bot
   * API's `parse_mode=HTML` actually renders (b/i/u/s/code/pre/a — see
   * `HtmlContentPolicy.TelegramEntry` on the backend, the two lists must stay in sync by hand).
   * No table/image/fonts/colour/headings/align — Telegram has no concept of any of them, and
   * the sanitizer would strip them on save anyway; showing the button would be a lie. */
  telegramLimited: ['bold', 'italic', 'underline', 'strike', 'code', 'link', 'undo'],
  /** Tour/day descriptions (phase 2). No `color`/`fontSize` on purpose: the public site's
   * typography is set by the design system, not by content (ADR 023). */
  description: ['bold', 'italic', 'underline', 'link', 'heading', 'bulletList', 'orderedList', 'blockquote', 'align', 'image', 'undo'],
  /** Short field: formatting and links only. */
  minimal: ['bold', 'italic', 'link', 'undo'],
} as const satisfies Record<string, readonly RichTextTool[]>
