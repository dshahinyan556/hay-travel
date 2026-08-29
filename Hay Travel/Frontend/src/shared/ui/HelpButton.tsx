import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIsCompactViewport } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useHelpReveal } from './HelpReveal'
import { Popover } from './Popover'
import { Sheet, SHEET_SINGLE_DETENT } from './Sheet'
import { CloseIcon } from './icons'

export interface HelpPanelProps {
  title: string
  /** Already-localised text — owned by the calling page/feature, not by this component (mirrors
   * `settingsCopy.ts`/`userCopy.ts`: each feature keeps its own copy module). */
  children: ReactNode
  /** Accessible name of the trigger button. Defaults to `t('ui.help.trigger', { title })`. */
  triggerLabel?: string
  /**
   * Which palette to render in — same contract and same reasoning as `Select`'s own `surface`
   * prop (see the long comment above it in `Select.tsx`): `/admin` never touches `data-theme`, so
   * reading it here would risk rendering the PUBLIC gold/wine skin inside an admin screen whenever
   * a visitor had switched the public site's theme earlier in the same tab. Added for F4 (the
   * first real `/admin` consumer, the user-detail screen) — flagged as an open question in this
   * component's original doc comment, resolved the same way `Select` already resolved it.
   * @default 'public'
   */
  surface?: 'public' | 'admin'
}

/**
 * Small round "?" trigger + popup with a short explanation — the one reusable "Help" pattern for
 * any admin/public page (introduced 2026-08-06 by Давид's request, architecture decision in
 * `admin-fixes-checklist-2026-08-06.txt` F14). Lives in `shared/ui` rather than
 * `features/admin/ui` on purpose: it carries no admin-specific types or role checks, it is just a
 * trigger + text content wrapping two already-shared primitives.
 *
 * Desktop: `Popover`. Compact viewport: `Sheet`, via the same `useIsCompactViewport` switch
 * `Select`/`DatePicker` already use — no new overlay mechanism.
 *
 * Escape / outside click / a close button all dismiss it (`Popover` and `Sheet` already implement
 * the first two; the close button is added here to mirror the mockup's `.hp-close`, since a
 * passive help panel has no natural "select and close" action the way `Select`'s options do).
 *
 * VISIBILITY: по умолчанию триггер виден всегда. Если вокруг стоит `HelpRevealZone` (вся
 * админка), на ПК он скрыт и проявляется по наведению на зону — см. доккоммент `HelpReveal.tsx`.
 * Скрыт он через `opacity`, а НЕ через размонтирование: место 32x32 остаётся занятым, поэтому
 * появление кнопки не двигает соседнюю вёрстку. Собственный фокус и открытая панель докладываются
 * зоне через `setTriggerEngaged` — иначе она погасила бы триггер под открытым поповером или
 * оставила клавиатурного пользователя на невидимой кнопке.
 *
 * Styled with the public site's role tokens by default (`bg-panel-raised`/`ring-edge-strong`/
 * `text-gold-ink`) — `surface="admin"` switches to admin's own light/teal literals instead,
 * exactly as `Select` does for the same reason (`data-theme` cannot disambiguate the two panels).
 */
export function HelpButton({ title, children, triggerLabel, surface = 'public' }: HelpPanelProps) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const isCompact = useIsCompactViewport()
  const titleId = useId()

  const reveal = useHelpReveal()
  const revealed = reveal?.revealed ?? true
  const setTriggerEngaged = reveal?.setTriggerEngaged

  const engaged = open || focused
  useEffect(() => {
    setTriggerEngaged?.(engaged)
    // Размонтирование условного триггера (`{dirty && <HelpButton/>}`) не должно оставить зону
    // навсегда «занятой».
    return () => setTriggerEngaged?.(false)
  }, [engaged, setTriggerEngaged])

  const { t } = useLocale()

  const close = useCallback(() => setOpen(false), [])
  const label = triggerLabel ?? t('ui.help.trigger', { title })

  const triggerClasses =
    surface === 'admin'
      ? 'bg-white text-neutral-600 ring-1 ring-neutral-300 hover:bg-neutral-100 hover:ring-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-900/30 focus-visible:outline-none'
      : 'bg-panel-raised text-gold-ink ring-1 ring-edge-strong hover:bg-gold-soft hover:ring-gold-line focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none'
  const panelClasses =
    surface === 'admin'
      ? 'w-[270px] rounded-xl border border-neutral-200 bg-white shadow-lg'
      : 'w-[270px] rounded-xl border border-edge-strong bg-panel-raised shadow-lg'
  const titleClasses = surface === 'admin' ? 'text-sm font-semibold text-neutral-900' : 'text-sm font-semibold text-ink'
  const closeClasses =
    surface === 'admin'
      ? 'icon-press -m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-neutral-400 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/30 focus-visible:outline-none'
      : 'icon-press -m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-ink-muted hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none'
  const bodyClasses = surface === 'admin' ? 'text-neutral-600' : 'text-ink-dim'

  /**
   * Появление и исчезновение НЕ симметричны, и это намеренно. Появление быстрое, на `--ease-out-soft`
   * (тот же токен, которым в этом проекте открываются все reveal-ы): почти всё движение проходит в
   * первые миллисекунды, поэтому кнопка читается как «уже была здесь», а не как выехавший элемент.
   * Исчезновение длиннее и мягче — она тихо уходит, не перетягивая взгляд с поля, которое админ в
   * этот момент заполняет.
   *
   * Масштаб (90% → 100% из центра) берёт на себя ощущение «проявилась», чтобы не пришлось двигать
   * кнопку с места: сдвиг потребовал бы `translate`, а он на мишени 32px читается как дребезг.
   *
   * Длительности — токены `--dur-*` из `index.css`, а не литералы: под
   * `prefers-reduced-motion: reduce` они там схлопываются в 1ms, поэтому отдельная
   * `motion-reduce`-ветка здесь не нужна.
   */
  const revealAnimation = revealed
    ? 'scale-100 opacity-100 duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]'
    : 'pointer-events-none scale-90 opacity-0 duration-[var(--dur-base)] ease-[var(--ease-in-out-soft)]'

  const panelBody = (
    <div className="p-3.5 text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 id={titleId} className={titleClasses}>
          {title}
        </h2>
        <button type="button" onClick={close} aria-label={t('ui.help.close')} className={closeClasses}>
          <CloseIcon size={14} />
        </button>
      </div>
      <div className={bodyClasses}>{children}</div>
    </div>
  )

  return (
    <>
      <span
        className={`inline-flex shrink-0 transition-[opacity,scale] will-change-[opacity,scale] ${revealAnimation}`}
      >
        <button
          ref={anchorRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((value) => !value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`icon-press inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-bold ${triggerClasses}`}
        >
          <span aria-hidden="true">?</span>
        </button>
      </span>

      {isCompact ? (
        <Sheet open={open} onClose={close} ariaLabel={title} detents={SHEET_SINGLE_DETENT}>
          {panelBody}
        </Sheet>
      ) : (
        <Popover open={open} onClose={close} anchorRef={anchorRef} className={panelClasses}>
          <div role="dialog" aria-labelledby={titleId}>
            {panelBody}
          </div>
        </Popover>
      )}
    </>
  )
}
