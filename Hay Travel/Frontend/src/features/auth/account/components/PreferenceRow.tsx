import { useId, type ReactNode } from 'react'

/**
 * Одна строка раздела «Предпочтения»: что настраивается — слева, чем настраивается — справа.
 *
 * ── Почему на телефоне контрол уезжает ВНИЗ, а не сжимается ───────────────────────────────────
 * На 375 px рядом с подписью остаётся ~180 px. Сегмент из четырёх валют, ужатый в них, даёт
 * кнопки по 40 px шириной — промахнуться легче, чем попасть. Поэтому до `sm` подпись и контрол
 * стоят друг под другом, а контрол растягивается на всю ширину (это же решение зафиксировано в
 * §10 мокапа), и только с `sm` строка становится строкой.
 *
 * ── `role="group"`, а не `<fieldset>` ─────────────────────────────────────────────────────────
 * Внутри лежит не поле формы, а группа кнопок с `aria-pressed` (и один `role="switch"`).
 * `<fieldset>`/`<legend>` пообещали бы скринридеру форму, которой здесь нет и которую нечего
 * отправлять; `role="group"` + `aria-labelledby` даёт ту же связку «эта подпись относится к этим
 * кнопкам» без вранья о природе контрола.
 */
export interface PreferenceRowProps {
  label: string
  /** Пояснение под подписью. Отсутствует там, где настройка говорит сама за себя. */
  hint?: ReactNode
  children: ReactNode
  /**
   * `false` — контрол уже сам себе группа с собственным именем (одиночный тумблер канала), и
   * второй `role="group"` вокруг него добавил бы скринридеру лишний уровень вложенности.
   */
  grouped?: boolean
  /**
   * `true` — строка остаётся строкой на ЛЮБОЙ ширине. Для тумблера: он занимает 44 px, рядом с
   * подписью помещается и на 375 px, а перенесённый вниз повисает в пустой строке и теряет связь
   * с тем, что включает. Сегменты и образцы палитры так не умеют — им нужна вся ширина.
   */
  inline?: boolean
}

export function PreferenceRow({
  label,
  hint,
  children,
  grouped = true,
  inline = false,
}: PreferenceRowProps) {
  const labelId = useId()

  return (
    <div
      className={
        inline
          ? 'flex items-center justify-between gap-4'
          : 'flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6'
      }
    >
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-semibold text-ink">
          {label}
        </p>
        {hint && (
          <p className="mt-0.5 max-w-[46ch] text-[12.5px] leading-relaxed break-words text-ink-muted">
            {hint}
          </p>
        )}
      </div>

      <div
        role={grouped ? 'group' : undefined}
        aria-labelledby={grouped ? labelId : undefined}
        className={inline ? 'shrink-0' : 'w-full sm:w-auto sm:shrink-0'}
      >
        {children}
      </div>
    </div>
  )
}
