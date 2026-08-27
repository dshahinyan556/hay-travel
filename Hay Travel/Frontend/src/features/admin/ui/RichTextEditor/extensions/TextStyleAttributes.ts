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

/**
 * `color` + `fontSize` as attributes of the SAME `textStyle` mark, instead of two separate
 * packages/marks (spec 011 §3.4). This is what fixes bug 1 from ADR 023 ("size, then colour —
 * the first one is reset"): with two independent marks, applying the second replaces the whole
 * mark set at that position; with one mark carrying two attributes, `mergeAttributes` combines
 * both `style` fragments into a single `<span style="…">` and neither wipes the other.
 */
export const TextStyleAttributes = Extension.create({
  name: 'textStyleAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
          color: {
            default: null,
            // The browser reports `el.style.color` as `rgb(185, 28, 28)`, not `#b91c1c` — without
            // normalizing here, a saved-then-reloaded colour would come back as `rgb(...)`, which
            // the backend colour validation (спека 012) either has to also accept or would silently
            // strip.
            parseHTML: (element: HTMLElement) => toHexColor(element.style.color),
            renderHTML: (attributes: { color?: string | null }) =>
              attributes.color ? { style: `color: ${attributes.color}` } : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
      // The caller (`ColorPicker`) always normalizes to `#rrggbb` before this runs.
      setTextColor:
        (color: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { color }).run(),
      unsetTextColor:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { color: null }).removeEmptyTextStyle().run(),
    }
  },
})
