import { HelpButton } from '@/shared/ui/HelpButton'

/**
 * Тонкая обёртка над `HelpButton` для этой фичи: подсказки раздела всегда одинаковые — заголовок
 * плюс один абзац текста, публичная палитра.
 *
 * Существует, чтобы правило «пояснения только за иконкой „?“, никогда инлайн-абзацем» было в
 * коде одним вызовом, а не тремя разными разметками в трёх файлах. В макете внутри форм нет ни
 * одного объясняющего абзаца — это то же правило.
 */
export function HelpButtonSlot({ title, body }: { title: string; body: string }) {
  return (
    <HelpButton title={title} surface="public">
      <p>{body}</p>
    </HelpButton>
  )
}
