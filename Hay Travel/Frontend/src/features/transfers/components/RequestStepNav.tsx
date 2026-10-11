import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ChevronLeftIcon } from '@/shared/ui/icons'

/**
 * Нижняя панель мастера: «Назад» и главное действие шага («Далее» / «Отправить заявку»).
 *
 * ── Почему `sticky`, а не `fixed` ─────────────────────────────────────────────────────────────
 * На телефоне кнопка «Далее» обязана быть под большим пальцем всегда, иначе на шаге с багажом до
 * неё надо доскроллить. Но `fixed` пришлось бы компенсировать выдуманным `padding-bottom` у
 * формы, и любое расхождение этих двух чисел означало бы поле, навсегда закрытое кнопкой.
 * `sticky` стоит В ПОТОКЕ последним элементом формы: пока форма длиннее экрана — панель приклеена
 * к низу, домотал до конца — она встала на своё место, и перекрывать ей нечего по построению.
 *
 * Отступ снизу — не ноль: внизу экрана уже живёт плавающая панель вкладок сайта (`MobileTabBar`,
 * ~92px вместе с safe-area). Панель мастера встаёт НАД ней; `env(safe-area-inset-bottom)` учтён,
 * иначе на айфонах с домашней полосой обе панели наехали бы друг на друга.
 *
 * На `lg` всё это выключается (`lg:static`): мышью до кнопки в конце формы добираться нечем,
 * а прилипшая панель отъедала бы высоту у экрана, где её и так хватает.
 *
 * ── Главная кнопка — `submit` ────────────────────────────────────────────────────────────────
 * Тип `submit`, а не `button` с обработчиком: тогда Enter в любом поле шага делает то же, что
 * кнопка, — переходит дальше. Ветку «дальше или отправить» решает форма, а не эта панель: панель
 * не знает и не должна знать, какой шаг последний.
 */
export interface RequestStepNavProps {
  /** `null` — первый шаг, отступать некуда. */
  onBack: (() => void) | null
  /** Подпись главной кнопки: «Далее» на промежуточных шагах, «Отправить заявку» на последнем. */
  primaryLabel: string
  /** Отправка в полёте: кнопка блокируется и меняет подпись. */
  busy?: boolean
  /**
   * Скрыть главную кнопку. Ровно один случай: её место занял блок «войдите, чтобы отправить» —
   * две кнопки, требующие одного и того же, читались бы как выбор, которого нет.
   */
  primaryHidden?: boolean
  /** Одна строка под кнопками. `null` — строки нет. */
  hint?: string | null
}

export function RequestStepNav({
  onBack,
  primaryLabel,
  busy = false,
  primaryHidden = false,
  hint = null,
}: RequestStepNavProps) {
  const { t } = useLocale()

  return (
    <div
      className="sticky z-20 mt-6 lg:static"
      style={{ bottom: 'calc(6.25rem + env(safe-area-inset-bottom))' }}
    >
      <div className="rounded-2xl border border-edge/70 bg-panel/95 p-3 shadow-[var(--shadow-lg)] backdrop-blur-md lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <div className="flex items-center gap-2.5">
          {onBack !== null && (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-ink-dim ring-1 ring-edge-strong transition-colors hover:bg-panel-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ChevronLeftIcon size={16} className="shrink-0" />
              {t('transfers.request.wizardBack')}
            </button>
          )}
          {!primaryHidden && (
            <button
              type="submit"
              disabled={busy}
              className="btn-sheen inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {primaryLabel}
            </button>
          )}
        </div>
        {hint !== null && (
          <p className="mt-2.5 text-center text-[12.5px] leading-snug text-ink-muted">{hint}</p>
        )}
      </div>
    </div>
  )
}
