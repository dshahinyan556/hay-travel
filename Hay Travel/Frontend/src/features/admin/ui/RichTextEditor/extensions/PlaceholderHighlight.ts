import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const TOKEN_RE = /\{\{[A-Za-z0-9_]+\}\}/g

/**
 * Purely visual "pill" decoration around already-inserted `{{Token}}` text, so the template owner
 * can SEE the placeholders instead of parsing raw curly braces (bug 3, ADR 023). The decoration
 * lives only in the editor view: `editor.getHTML()` never contains it, so the stored HTML — and
 * the `\{\{(?<token>[A-Za-z0-9_]+)\}\}` regex the email renderer runs on it — are untouched. The
 * token itself stays plain text; nothing about the storage format changes.
 */
export const PlaceholderHighlight = Extension.create({
  name: 'placeholderHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('placeholderHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              for (const match of node.text.matchAll(TOKEN_RE)) {
                const from = pos + (match.index ?? 0)
                decorations.push(
                  Decoration.inline(from, from + match[0].length, {
                    class:
                      'rounded bg-neutral-900/5 px-1 font-semibold text-neutral-700 ring-1 ring-neutral-900/10',
                  }),
                )
              }
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
