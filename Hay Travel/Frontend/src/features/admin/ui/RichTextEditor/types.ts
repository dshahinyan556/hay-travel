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
  | 'fontSize'
  | 'align'
  | 'image'
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
  /** Email template bodies. The fullest set the sanitizer allow-list permits — Давид confirmed
   * 2026-08-22 that headings, alignment and images are all needed. */
  email: [
    'bold', 'italic', 'underline', 'link',
    'heading', 'fontSize', 'color', 'align',
    'bulletList', 'orderedList', 'image', 'undo',
  ],
  /** Tour/day descriptions (phase 2). No `color`/`fontSize` on purpose: the public site's
   * typography is set by the design system, not by content (ADR 023). */
  description: ['bold', 'italic', 'underline', 'link', 'heading', 'bulletList', 'orderedList', 'blockquote', 'align', 'image', 'undo'],
  /** Short field: formatting and links only. */
  minimal: ['bold', 'italic', 'link', 'undo'],
} as const satisfies Record<string, readonly RichTextTool[]>
