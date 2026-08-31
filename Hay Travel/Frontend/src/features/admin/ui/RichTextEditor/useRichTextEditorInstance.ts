import { useEffect, useMemo, useRef } from 'react'
import { useEditor, type Editor, type Extensions } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { TextStyleAttributes } from './extensions/TextStyleAttributes'
import { PlaceholderHighlight } from './extensions/PlaceholderHighlight'
import { RichImage } from './extensions/RichImage'
import { editorHtml } from './lib/richTextHtml'
import { richTextContentClass } from './lib/richTextContentClass'
import type { RichTextTool } from './types'

interface UseRichTextEditorInstanceArgs {
  value: string
  onChange: (html: string) => void
  disabled: boolean
  toolset: readonly RichTextTool[]
  hasPlaceholders: boolean
  ariaLabel?: string
}

/**
 * Assembles the extension list for a given `toolset` — pure, so the mapping between "instrument
 * present" and "node/mark enabled" is readable in one place and unit-testable without a DOM.
 *
 * `codeBlock`/`horizontalRule` stay disabled unconditionally (no toolbar button asks for a
 * fenced ``` block or `<hr>`). `code` (inline `<code>`, the "Preformatted" instrument) used to
 * be disabled here too because `<pre>`/`<code>` weren't in the sanitizer allow-list and were
 * stripped WITH their content on save — that allow-list is fixed now (`HtmlContentPolicy.cs`,
 * Notification Templates 2026-08-31), so `code` is wired through the ordinary `has('code')` gate
 * like every other tool. This file is the frontend's copy of that allow-list; the two must be
 * kept in sync by hand (ADR 023).
 */
function buildExtensions(toolset: readonly RichTextTool[], hasPlaceholders: boolean): Extensions {
  const has = (tool: RichTextTool) => toolset.includes(tool)

  const extensions: Extensions = [
    StarterKit.configure({
      codeBlock: false,
      horizontalRule: false,
      code: has('code') && {},
      bold: has('bold') && {},
      italic: has('italic') && {},
      underline: has('underline') && {},
      strike: has('strike') && {},
      blockquote: has('blockquote') && {},
      bulletList: has('bulletList') && {},
      orderedList: has('orderedList') && {},
      // H1-H6 (Notification Templates, 2026-08-31) — HTML-потолок, выше H6 не бывает.
      heading: has('heading') ? { levels: [1, 2, 3, 4, 5, 6] } : false,
      link: has('link')
        ? {
            openOnClick: false,
            autolink: true,
            // Matches the backend's AllowedSchemes (спека 012).
            protocols: ['http', 'https', 'mailto'],
            HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
          }
        : false,
    }),
  ]

  if (has('color') || has('fontSize') || has('fontFamily')) {
    extensions.push(TextStyle, TextStyleAttributes)
  }
  if (has('fontFamily')) {
    extensions.push(FontFamily)
  }
  if (has('highlight')) {
    // multicolor: своя палитра заливки, независимая от TextStyle/color.
    extensions.push(Highlight.configure({ multicolor: true }))
  }
  if (has('align')) {
    extensions.push(TextAlign.configure({ types: ['heading', 'paragraph'] }))
  }
  if (has('image')) {
    extensions.push(RichImage)
  }
  if (has('table')) {
    extensions.push(Table.configure({ resizable: false }), TableRow, TableHeader, TableCell)
  }
  if (hasPlaceholders) {
    extensions.push(PlaceholderHighlight)
  }

  return extensions
}

/**
 * Owns the Tiptap `Editor` instance: extension assembly, creation, and the two-way sync with the
 * caller's `value` (spec 011 §3.2). This is where bug 1 from ADR 023 actually gets fixed — Tiptap
 * keeps selection in ITS OWN state, so nothing here saves/restores a `Range` by hand, and content
 * is never reassigned through `innerHTML` under the visitor.
 */
export function useRichTextEditorInstance({
  value,
  onChange,
  disabled,
  toolset,
  hasPlaceholders,
  ariaLabel,
}: UseRichTextEditorInstanceArgs): Editor | null {
  // Kept in a ref so a new `onChange` identity from the parent on every render never forces
  // `useEditor` to rebuild the editor (which would drop selection/undo history mid-edit).
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // The last HTML this hook itself emitted — lets the value-sync effect below tell "the parent
  // echoed back what we just sent" apart from "the parent has a genuinely new value", which is
  // what stops the sync effect from fighting every keystroke.
  const lastEmittedRef = useRef(value)

  const extensions = useMemo(
    () => buildExtensions(toolset, hasPlaceholders),
    // `toolset` is a readonly array from a `RICH_TEXT_TOOLSETS` constant or a caller-built one;
    // joining it into a string is what makes the memo key stable across re-renders instead of
    // rebuilding the editor (and losing selection/undo history) every time the caller re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolset.join('|'), hasPlaceholders],
  )

  const editor = useEditor(
    {
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
      onUpdate: ({ editor: instance }) => {
        const html = editorHtml(instance)
        lastEmittedRef.current = html
        onChangeRef.current(html)
      },
    },
    [extensions],
  )

  // External `value` → editor. Guarded against re-applying what THIS hook just emitted, so typing
  // a single character never round-trips through the parent and back as a full `setContent` (ADR
  // 023, "второе действие отменяет первое" — the same class of bug as bug 1, just for the whole
  // document instead of one mark). `emitUpdate: false` is required so this never re-triggers
  // `onUpdate` and loops.
  useEffect(() => {
    if (!editor || value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    editor.commands.setContent(value || '', { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  return editor
}
