import { SuggestInput } from '@/shared/ui'
import { MapPinIcon } from '@/shared/ui/icons'

/**
 * Поле точки маршрута: свободный текст с подсказками из каталога `Place` (решение 0.8).
 *
 * Именно подсказки, а не выбор из списка: адреса, которого нет в каталоге, — обычное дело
 * («Ереван, Северный проспект, у отеля»), и строгий `Select` сделал бы такую заявку
 * неотправляемой. Поэтому под капотом `SuggestInput` (редактируемый комбобокс), а не `Select`.
 *
 * Один компонент на три места — «откуда», «куда» и каждая остановка: три копии одной и той же
 * связки «поле + булавка + подсказки» разъехались бы по мелочам, а поля маршрута обязаны
 * выглядеть одинаково, иначе форма читается как собранная наспех.
 *
 * `pr-10` + абсолютная булавка, а не иконка внутри `SuggestInput`: примитив общий с админкой, и
 * встраивать в него декор публичного экрана — значит платить за это на всех остальных вызовах.
 */
export interface RoutePointFieldProps {
  id?: string
  value: string
  onChange: (value: string) => void
  suggestions: readonly string[]
  placeholder: string
  /** Текст «в каталоге такой точки нет» — панель подсказок ничего не навязывает, она сообщает. */
  noResultsText: string
  error?: boolean
  disabled?: boolean
  'aria-label'?: string
}

export function RoutePointField({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  noResultsText,
  error = false,
  disabled = false,
  'aria-label': ariaLabel,
}: RoutePointFieldProps) {
  return (
    <div className="relative">
      <SuggestInput
        id={id}
        value={value}
        onChange={onChange}
        // Выбор подсказки и ручной ввод дают ОДИН результат: подсказка это ускорение, а не
        // отдельный смысл (в отличие от админского каталога, где выбор ещё и заполняет соседнее
        // поле).
        onPick={onChange}
        suggestions={[...suggestions]}
        noResultsText={noResultsText}
        surface="public"
        error={error}
        disabled={disabled}
        maxLength={200}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pr-10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
      >
        <MapPinIcon size={17} />
      </span>
    </div>
  )
}
