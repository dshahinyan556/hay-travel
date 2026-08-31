import { AlertIcon } from '@/shared/ui/icons'

/**
 * Сообщение об отказе внутри блока контактов.
 *
 * Копия `features/auth/components/AuthShell`'s `AuthError` по разметке — но НЕ он: `AuthShell`
 * живёт в `features/auth`, а этот блок в `shared` и оттуда импортировать не может. Тащить сюда
 * весь `AuthShell` ради восьми строк было бы дороже, чем повторить их: перенести стоило то, где
 * расхождение реально опасно (правила валидации), а не пилюлю с иконкой.
 */
export function ContactAlert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="alert-in flex items-start gap-2.5 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger ring-1 ring-danger/40"
    >
      <AlertIcon size={17} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{message}</span>
    </p>
  )
}
