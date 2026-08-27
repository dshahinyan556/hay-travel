import type { Editor } from '@tiptap/react'

/**
 * Empty/whitespace-only, or nothing but one or more empty paragraphs (`<p></p>`, `<p><br></p>`).
 * Used on STORED html (a string), independent of any live editor instance — the `isDirty`/
 * required-field checks in `EmailTemplateCard` and friends need this before an editor even exists.
 */
const EMPTY_HTML_RE = /^(?:\s*<p>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)*$/i

export function isEmptyHtml(html: string): boolean {
  return EMPTY_HTML_RE.test(html)
}

/** True when the document contains at least one `image` node — `editor.isEmpty` only looks at
 * text content, so a document that is JUST a picture would otherwise be reported as empty
 * (spec 011 §3.7). */
function hasImageNode(editor: Editor): boolean {
  let found = false
  editor.state.doc.descendants((node) => {
    if (found) return false
    if (node.type.name === 'image') {
      found = true
      return false
    }
    return true
  })
  return found
}

/**
 * The document's HTML. An empty document is reported as `''`, never `'<p></p>'` — otherwise
 * `EmailTemplateCard`'s dirty-check and required-field validation would see a value that looks
 * non-empty when nothing was actually typed.
 */
export function editorHtml(editor: Editor): string {
  if (editor.isEmpty && !hasImageNode(editor)) return ''
  return editor.getHTML()
}

const LINK_SCHEME_RE = /^(https?:|mailto:)/i
// Same shape as the AllowedSchemes the backend accepts (spec 011 §3.7) — a bare domain is the one
// thing worth auto-completing; anything else without a recognised scheme (`javascript:`,
// `data:`, plain garbage) is rejected rather than guessed at.
const BARE_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/.*)?$/i

/** `example.com` → `https://example.com`; `http(s)://…`/`mailto:…` pass through unchanged;
 * everything else (`javascript:`, `data:`, garbage) → `null`. */
export function normalizeLinkHref(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (LINK_SCHEME_RE.test(trimmed)) return trimmed
  if (BARE_DOMAIN_RE.test(trimmed)) return `https://${trimmed}`
  return null
}

const IMAGE_URL_SCHEME_RE = /^https?:\/\//i

/** Same idea as `normalizeLinkHref` but for an image `src`: no `mailto:`, and a path already
 * under `/uploads/` (what the upload endpoint itself returns) is accepted as-is — it is
 * intentionally relative (ADR 023: the domain gets stitched on at send time, not here). */
export function normalizeImageSrc(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/uploads/')) return trimmed
  if (IMAGE_URL_SCHEME_RE.test(trimmed)) return trimmed
  return null
}
