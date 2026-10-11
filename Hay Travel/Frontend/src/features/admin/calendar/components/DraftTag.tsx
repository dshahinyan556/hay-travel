import type { ReactNode } from 'react'

/** Метка состояния черновика: `info` (синяя) — «будет закрыт», «новое»; `removed` (красная) —
 * «удалится». Тот же вид, что у `DraftTag` в «Продуктах» — один язык черновика на весь экран. */
export function DraftTag({ tone, children }: { tone: 'info' | 'removed'; children: ReactNode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${
        tone === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {children}
    </span>
  )
}
