import type { ReactNode } from 'react'

/**
 * Панель «списка нет»: пусто ЛИБО запрос не удался. Один компонент на оба случая и на оба
 * раздела кабинета — форма у них одна (заголовок, объяснение, ряд действий по центру), разница
 * только в цвете заголовка и в том, что предлагается сделать.
 *
 * Ошибка одного раздела не роняет кабинет: это панель ВНУТРИ раздела, а не экран ошибки. То же
 * правило, по которому падение `GET Account/Me` превращает две строки в «—», а не заменяет собой
 * страницу.
 *
 * `role="status"` — появление панели это результат запроса, о котором незрячий пользователь
 * должен узнать, не наткнувшись на неё табом. `alert` был бы перебором: перебивать чтение ради
 * «заказов пока нет» незачем.
 */
export interface AccountStatePanelProps {
  title: string
  body: string
  /** `danger` — красный только у ЗАГОЛОВКА: тело остаётся обычным, красный абзац целиком
   * читается как «всё сломано», хотя сломан один запрос. */
  tone?: 'neutral' | 'danger'
  /** Кнопки под текстом. Их может не быть вовсе — тогда ряд не рисуется. */
  children?: ReactNode
}

export function AccountStatePanel({ title, body, tone = 'neutral', children }: AccountStatePanelProps) {
  return (
    <div
      role="status"
      className="veil-top rounded-2xl px-6 py-10 text-center ring-1 ring-edge ring-inset"
    >
      <p className={`text-[17px] font-semibold ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-muted">
        {body}
      </p>
      {children && (
        <div className="mt-4 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          {children}
        </div>
      )}
    </div>
  )
}
