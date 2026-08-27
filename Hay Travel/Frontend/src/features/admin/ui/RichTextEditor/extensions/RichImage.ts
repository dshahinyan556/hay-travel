import Image from '@tiptap/extension-image'

/**
 * Block image with STRICTLY three attributes. Nothing else — `style`, `class`, `srcset`,
 * `loading`, `data-*` would not survive the sanitizer allow-list (спека 012) and would be
 * silently stripped on save. `allowBase64: false` — a data: URL in an email weighs as much as the
 * picture itself and most mail clients strip it anyway (spec 011 §3.11).
 */
export const RichImage = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      // Pixel width as an HTML ATTRIBUTE, not CSS — the only thing that actually sizes an image
      // in Outlook/Gmail (they ignore `max-width`). On the web this is overridden by
      // `[&_img]:max-w-full` from `richTextContentClass` (§3.8); CSS wins there, no conflict.
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width'),
        renderHTML: (attributes: { width?: string | number | null }) =>
          attributes.width ? { width: String(attributes.width) } : {},
      },
    }
  },
}).configure({ inline: false, allowBase64: false })
