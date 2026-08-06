import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setCurrency, useCurrency } from '@/shared/currency'
import { useIsCompactViewport } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Popover, Sheet, SHEET_SINGLE_DETENT } from '@/shared/ui'
import { ChevronDownIcon, CheckIcon } from '@/shared/ui/icons'

/**
 * Display-currency switch — a sibling of `LanguageSwitch`/`ThemeToggle`. Presentation only: all the
 * state, the fetch and the persistence live in `shared/currency` (same split as `ThemeToggle` ↔
 * `shared/lib/theme`).
 *
 * ── Why a dropdown and not a segmented pill ───────────────────────────────────────────────────
 * `LanguageSwitch`'s segment control works for two options. Four currency pills would not fit the
 * header capsule at 375px, and the control would grow every time a currency is added — which the
 * backend contract explicitly allows (one catalog entry, zero frontend changes). The trigger here
 * is a fixed ~44px symbol regardless of how many currencies exist.
 *
 * ── Two a11y patterns, by viewport (same split as `shared/ui/Select`) ─────────────────────────
 * Desktop: focus stays on the trigger, the highlighted option moves via `aria-activedescendant`
 * inside a `Popover`. Compact: a `Sheet` whose options are real focusable list items, since the
 * sheet already moves focus into itself.
 *
 * ── 503 degrade ───────────────────────────────────────────────────────────────────────────────
 * When the rates endpoint has never answered, the store's state is AMD-only. The trigger then
 * renders DISABLED with `֏` rather than disappearing: a control that vanishes reads as a broken
 * page, a disabled one reads as "unavailable right now".
 */
export function CurrencySwitch() {
  const { t } = useLocale()
  const { rates, selectedCode, active, status } = useCurrency()
  const isCompact = useIsCompactViewport()

  const listboxId = `${useId()}-currency`
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  const selectedIndex = rates.findIndex((rate) => rate.code === selectedCode)
  // The visitor's own choice, even during the load window when `active` is still AMD — the switcher
  // must show what they picked, `active` is only what the prices render in.
  const triggerSymbol = selectedIndex >= 0 ? rates[selectedIndex].symbol : active.symbol
  const unavailable = status === 'error' && rates.length <= 1

  const close = useCallback(() => setOpen(false), [])

  const commit = useCallback(
    (index: number) => {
      const rate = rates[index]
      if (!rate) return
      setCurrency(rate.code)
      setOpen(false)
      triggerRef.current?.focus()
    },
    [rates],
  )

  const openAt = useCallback((index: number) => {
    setActiveIndex(index < 0 ? 0 : index)
    setOpen(true)
  }, [])

  // Compact only: land focus on the selected option once the sheet is up. `Sheet`'s own focus trap
  // commits first (it focuses the container), this moves focus the rest of the way onto a real
  // option. Fires once per open, hence the deliberate two-dep array.
  useEffect(() => {
    if (!open || !isCompact) return
    optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus()
    // `selectedIndex` is deliberately not a dependency: this should fire once per open, not every
    // time the selection changes while the sheet is up.
  }, [open, isCompact])

  function step(from: number, delta: 1 | -1): number {
    return Math.min(Math.max(from + delta, 0), rates.length - 1)
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (unavailable) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (!open) openAt(selectedIndex)
        else setActiveIndex((current) => step(current, event.key === 'ArrowDown' ? 1 : -1))
        return
      case 'Home':
        if (!open) return
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
        if (!open) return
        event.preventDefault()
        setActiveIndex(rates.length - 1)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!open) openAt(selectedIndex)
        else commit(activeIndex)
        return
      default:
    }
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLLIElement>, index: number) {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(index)
        return
      case 'ArrowDown':
        event.preventDefault()
        optionRefs.current[step(index, 1)]?.focus()
        return
      case 'ArrowUp':
        event.preventDefault()
        optionRefs.current[step(index, -1)]?.focus()
        return
      case 'Home':
        event.preventDefault()
        optionRefs.current[0]?.focus()
        return
      case 'End':
        event.preventDefault()
        optionRefs.current[rates.length - 1]?.focus()
        return
      default:
    }
  }

  const optionIdFor = (index: number) => `${listboxId}-option-${index}`

  // 44px minimum row height (project rule) — these rows are a touch target on the mobile sheet.
  function optionClasses(selected: boolean, highlighted: boolean): string {
    const base = 'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:bg-wine-tint focus-visible:outline-none'
    if (selected) return `${base} bg-wine-tint font-semibold text-gold-light`
    return `${base} ${highlighted ? 'bg-wine-tint text-gold-light' : 'text-ink-dim'}`
  }

  function renderOptions(mode: 'popover' | 'sheet') {
    return (
      <ul role="listbox" id={listboxId} aria-label={t('currency.switchAriaLabel')} className="flex flex-col">
        {rates.map((rate, index) => (
          <li
            key={rate.code}
            ref={(node) => {
              optionRefs.current[index] = node
            }}
            id={optionIdFor(index)}
            role="option"
            aria-selected={index === selectedIndex}
            aria-label={t('currency.optionAriaLabel', { code: rate.code })}
            tabIndex={mode === 'sheet' ? 0 : undefined}
            onMouseDown={(event) => mode === 'popover' && event.preventDefault()}
            onMouseEnter={() => mode === 'popover' && setActiveIndex(index)}
            onKeyDown={mode === 'sheet' ? (event) => handleOptionKeyDown(event, index) : undefined}
            onClick={() => commit(index)}
            className={optionClasses(index === selectedIndex, mode === 'popover' && index === activeIndex)}
          >
            <span aria-hidden="true" className="w-4 shrink-0 text-center">
              {rate.symbol}
            </span>
            <span className="flex-1">{rate.code}</span>
            {index === selectedIndex && <CheckIcon size={15} className="shrink-0" />}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && !isCompact ? optionIdFor(activeIndex) : undefined}
        aria-label={t('currency.switchAriaLabel')}
        title={unavailable ? t('currency.unavailable') : undefined}
        disabled={unavailable}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={handleTriggerKeyDown}
        onBlur={() => {
          // Desktop only: on the sheet focus deliberately leaves the trigger for the dialog, so a
          // blur there must not close it (`Sheet`'s backdrop/Escape handle dismissal instead).
          if (open && !isCompact) setOpen(false)
        }}
        // Same 40px circle-height / `ring-edge` chrome as `ThemeToggle`, widened just enough for the
        // symbol and its chevron — the header capsule is at its tightest at 375px.
        className="icon-press relative inline-flex h-10 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-sm text-ink-dim ring-1 ring-edge hover:text-gold-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true">{triggerSymbol}</span>
        <ChevronDownIcon size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {isCompact ? (
        /*
          Portaled to `document.body`, unlike every other `Sheet` call site — and this is not
          cosmetic. `Sheet`'s root is `fixed inset-0`, but `Header`'s capsule carries
          `backdrop-blur-md`, and a `backdrop-filter` makes an element a CONTAINING BLOCK for its
          fixed-position descendants. Rendered in place, the sheet's `inset-0` therefore resolves to
          the ~63px header pill instead of the viewport, and `items-end` parks the panel almost
          entirely above the top edge (measured: `top: -197px` at 375×720). Every other overlay
          primitive in the project already portals (`Popover`, `Modal`, `SidePanel`, the gallery
          lightbox); `Sheet` is the one that does not, so the portal is applied here. If a second
          header-level sheet ever appears, promote this into `Sheet` itself instead of repeating it.
        */
        createPortal(
          <Sheet
            open={open}
            onClose={close}
            ariaLabel={t('currency.switchAriaLabel')}
            detents={SHEET_SINGLE_DETENT}
          >
            <div className="px-1 pt-1 pb-2 text-sm font-semibold text-ink">
              {t('currency.switchAriaLabel')}
            </div>
            {renderOptions('sheet')}
          </Sheet>,
          document.body,
        )
      ) : (
        <Popover
          open={open}
          onClose={close}
          anchorRef={triggerRef}
          className="w-36 overflow-hidden rounded-2xl border border-edge/70 bg-panel/95 p-1.5 shadow-lg shadow-black/30 backdrop-blur-md"
        >
          {renderOptions('popover')}
        </Popover>
      )}
    </div>
  )
}
