/**
 * Tailwind classes for DISPLAYING rich-text content — inside the editor itself, and (phase 2) by
 * the public renderer. There is no `@tailwindcss/typography` in this project, and Preflight resets
 * list markers/heading sizes to nothing, so without these rules bullets/numbers/heading sizes are
 * invisible even though the tags are there (spec 011 §3.8).
 */
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
  // `max-w-full` overrides the HTML `width` attribute on the image: the attribute is what the
  // EMAIL needs (mail clients ignore CSS `max-width`), the class is what the WEB needs — CSS wins
  // here on purpose, no conflict.
  '[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_img.ProseMirror-selectednode]:outline [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-neutral-900',
].join(' ')
