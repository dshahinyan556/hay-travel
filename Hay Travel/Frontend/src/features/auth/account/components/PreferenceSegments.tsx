/**
 * Выбор одного значения из двух-четырёх равнозначных — тема, валюта, язык.
 *
 * Сегменты, а не выпадающий список: вариантов мало, и увидеть их все сразу дешевле, чем открывать
 * меню ради двух строк. Это же и причина, по которой валюта здесь выглядит иначе, чем в шапке:
 * `CurrencySwitch` — попап/шторка, потому что каталог валют не имеет верхней границы и однажды
 * станет длинным; в кабинете строка сегментов честно ломается на вторую при пятой валюте, а
 * пятой валюты сегодня нет.
 *
 * ── Почему `aria-pressed`, а не `role="radio"` ────────────────────────────────────────────────
 * Радиогруппа обязана вести себя как радиогруппа: одна остановка табуляции на всю группу и
 * перемещение стрелками. Здесь же соседний `LanguageSwitch` в шапке уже сделан кнопками с
 * `aria-pressed`, и вводить в кабинете вторую механику для того же самого выбора значило бы
 * заставить человека переучиваться между шапкой и разделом. Каждый сегмент — обычная кнопка,
 * доходимая табом.
 */

export interface PreferenceSegmentOption<T extends string> {
  value: T
  /** Подпись сегмента. Может быть коротким глифом (`֏`) — тогда нужен `srLabel`. */
  label: string
  /**
   * Полное имя для скринридера, когда подпись — символ валюты или двухбуквенный код. Без него
   * сегмент читался бы как «драм» вместо «армянский драм, AMD».
   */
  srLabel?: string
  disabled?: boolean
}

export interface PreferenceSegmentsProps<T extends string> {
  options: readonly PreferenceSegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Вся группа недоступна — например, курсы валют так и не приехали. */
  disabled?: boolean
}

export function PreferenceSegments<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: PreferenceSegmentsProps<T>) {
  return (
    // `w-full` до `sm` — растянутый на всю ширину трек из §10 мокапа; с `sm` группа сжимается по
    // содержимому и встаёт справа от подписи.
    //
    // `flex-wrap` сегодня ни на что не влияет: четыре валюты (`֏ AMD $ USD € EUR ₽ RUB`) занимают
    // ~296 px из доступных на 375 px ~311. Он здесь на пятую валюту, которую каталог бэкенда
    // обещает добавлять «одной строкой в БД, без правок фронта»: тогда трек станет двухрядным, а
    // не вылезет за карточку и не отдаст странице горизонтальную прокрутку.
    <div className="flex w-full flex-wrap items-center gap-1 rounded-full bg-panel-raised p-1 ring-1 ring-edge sm:w-auto">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled || option.disabled}
            aria-pressed={active}
            aria-label={option.srLabel}
            // `min-h-9` — видимая высота сегмента; до 44 px зону нажатия растягивает невидимый
            // `before:` (тот же приём, что у `LanguageSwitch`), чтобы соседние сегменты не начали
            // отталкивать друг друга ради высоты.
            className={[
              'relative inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-[13px] whitespace-nowrap transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] sm:flex-none',
              "before:absolute before:-top-1 before:-bottom-1 before:left-0 before:right-0 before:content-['']",
              'focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'bg-gold-fill font-semibold text-gold-on'
                : 'text-ink-dim hover:text-gold-ink',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
