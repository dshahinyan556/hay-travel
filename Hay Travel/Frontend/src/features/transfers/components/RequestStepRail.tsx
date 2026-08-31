import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useIsCompactViewport } from '@/shared/hooks'
import { CheckIcon } from '@/shared/ui/icons'
import { WIZARD_STEPS, WIZARD_STEP_COUNT, WIZARD_STEP_TITLES, type WizardStep } from '../lib/transferWizard'

/**
 * Указатель прогресса мастера заявки: пронумерованный рельс на десктопе, «Шаг 2 из 3» + тонкая
 * полоса на телефоне.
 *
 * Зачем он вообще: у заявки нет цены, значит нет и ответа на вопрос «сколько мне ещё осталось».
 * Форма без видимого конца — форма, которую бросают на середине. Номера шагов не украшение, они
 * и есть обещание «это скоро кончится».
 *
 * ── Почему на телефоне не тот же рельс ────────────────────────────────────────────────────────
 * Три подписи вроде «Пассажиры и багаж» в один ряд на 375px дают либо горизонтальную прокрутку,
 * либо шрифт, который не читается. Полоса прогресса сообщает ровно то же самое («две трети
 * позади») и занимает 4px по высоте, а название текущего шага рядом с «Шаг 2 из 3» держит
 * контекст. Ветка выбирается ХУКОМ, а не `hidden lg:flex`: две разметки, отличающиеся только
 * видимостью, читались бы скринридеру дважды подряд.
 *
 * ── Назад можно кликом, вперёд нельзя ─────────────────────────────────────────────────────────
 * Пройденный шаг — кнопка: вернуться и поправить дату должно быть одним движением, а не тремя
 * «Назад». Будущий шаг кнопкой не становится даже когда текущий заполнен верно: прыжок вперёд в
 * обход проверки — это способ дойти до отправки с пустым обязательным полем.
 */
export interface RequestStepRailProps {
  current: WizardStep
  /** Вернуться на уже пройденный шаг. Вперёд рельс не пускает — см. заголовок файла. */
  onGoTo: (step: WizardStep) => void
}

export function RequestStepRail({ current, onGoTo }: RequestStepRailProps) {
  const { t } = useLocale()
  const isCompact = useIsCompactViewport()

  const currentTitle = t(WIZARD_STEP_TITLES[current])

  if (isCompact) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="shrink-0 text-[11px] tracking-[0.14em] text-gold-ink uppercase">
            {t('transfers.request.wizardCounter', {
              current: current + 1,
              total: WIZARD_STEP_COUNT,
            })}
          </p>
          <p className="min-w-0 truncate text-[13px] font-medium text-ink">{currentTitle}</p>
        </div>
        <div
          role="progressbar"
          aria-label={t('transfers.request.wizardProgressAria')}
          aria-valuemin={1}
          aria-valuemax={WIZARD_STEP_COUNT}
          aria-valuenow={current + 1}
          aria-valuetext={currentTitle}
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-edge"
        >
          <div
            className="h-full rounded-full bg-gold-fill transition-[width] duration-[var(--dur-base)]"
            style={{ width: `${((current + 1) / WIZARD_STEP_COUNT) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <nav aria-label={t('transfers.request.wizardNavAria')}>
      <ol className="flex items-center gap-2">
        {WIZARD_STEPS.map((step) => {
          const title = t(WIZARD_STEP_TITLES[step])
          const isDone = step < current
          const isCurrent = step === current

          return (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-2">
              {isDone ? (
                <button
                  type="button"
                  onClick={() => onGoTo(step)}
                  className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full px-2 py-1.5 text-left transition-colors hover:bg-panel-raised focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                  aria-label={t('transfers.request.wizardGoTo', { n: step + 1, title })}
                >
                  <StepBullet state="done" n={step + 1} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim group-hover:text-ink">
                    {title}
                  </span>
                </button>
              ) : (
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5"
                >
                  <StepBullet state={isCurrent ? 'current' : 'upcoming'} n={step + 1} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      isCurrent ? 'font-medium text-ink' : 'text-ink-muted'
                    }`}
                  >
                    {title}
                  </span>
                </div>
              )}

              {/* Соединитель рисуется ПОСЛЕ шага и только между шагами: он про переход, а не
                  про сам шаг, и после последнего вёл бы в никуда. */}
              {step < WIZARD_STEP_COUNT - 1 && (
                <span
                  aria-hidden="true"
                  className={`h-px w-6 shrink-0 ${step < current ? 'bg-gold-line' : 'bg-edge'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Кружок с номером шага. Пройденный несёт галочку вместо цифры — номер пройденного шага уже
 * ничего не сообщает, а «сделано» сообщает. */
function StepBullet({ state, n }: { state: 'done' | 'current' | 'upcoming'; n: number }) {
  const shape =
    state === 'done'
      ? 'bg-gold-fill text-gold-on'
      : state === 'current'
        ? 'bg-accent-soft text-gold-ink ring-1 ring-gold-line'
        : 'text-ink-muted ring-1 ring-edge-strong'

  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors duration-[var(--dur-micro)] ${shape}`}
    >
      {state === 'done' ? <CheckIcon size={14} strokeWidth={2.4} /> : n}
    </span>
  )
}
