import { useCallback, useEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { formatMoney, setCurrency, useCurrency } from '@/shared/currency'
import type { CurrencyRate } from '@/shared/currency'
import { useIsCompactViewport } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Popover, Sheet, SHEET_SINGLE_DETENT } from '@/shared/ui'
import { ChevronDownIcon, CheckIcon } from '@/shared/ui/icons'

/**
 * Display-currency switch — a sibling of `LanguageSwitch`/`ThemeToggle`. Presentation only: all the
 * state, the fetch and the persistence live in `shared/currency` (same split as `ThemeToggle` ↔
 * `shared/lib/theme`).
 *
 * ── Rebuilt 2026-08-10 ─────────────────────────────────────────────────────────────────────────
 * Both viewports now render the same row content — a symbol badge, the code, the live rate
 * (`1 USD ≈ 480 ֏`, from `rate.ratePerUnitAmd` via `formatMoney`), a checkmark on the selected row,
 * and a footer with `lastFetchedAt`/`isStale`. None of that was surfaced before even though
 * `CurrencyState` already carried it. Only the SHELL still differs by viewport: `Popover` (desktop,
 * roving `aria-activedescendant`, focus stays on the trigger) vs `Sheet` (compact, real focusable
 * list items) — same split as `shared/ui/Select`, because a bottom sheet and an anchored popup are
 * two different a11y patterns, not two skins on one component.
 *
 * ── Fixed-width trigger glyphs ─────────────────────────────────────────────────────────────────
 * The symbol (and, from `lg`, the code) sit in fixed-width slots (`w-4` / `w-8`) instead of sizing
 * to each glyph's natural width. Without that, switching currency changed the trigger's own width
 * by a few px (a 3-letter code is not the same pixel width for every code, and neither are the
 * symbols) — which nudged every control to its right (`LanguageSwitch`, `ThemeToggle`, `UserMenu`)
 * sideways on every selection, since they all live in one `flex` cluster anchored to the header's
 * right edge. Confirmed by measuring the trigger's `getBoundingClientRect()` before/after a commit.
 *
 * ── Hover: a tint, not a block ────────────────────────────────────────────────────────────────
 * Rows highlight with `bg-gold-fill/10` (+ a gold ring on the badge), not the solid `bg-wine-tint`
 * block `UserMenu`'s menu uses. That treatment doubles up badly here: the selected row already owns
 * a solid gold-filled badge, and a full dark block behind it on hover read as two competing filled
 * shapes rather than one row previewing the next. A translucent tint plus the same gold ink the
 * selected row already uses reads as "this is what selecting would look like," not a second control.
 *
 * ── Why a dropdown and not a segmented pill ────────────────────────────────────────────────────
 * `LanguageSwitch`'s segment control works for two options. The backend catalog contract (AMD
 * today, "one DB row, zero frontend changes" for the next currency) means this list has no upper
 * bound — a row of pills would need a redesign the day a fifth currency is added, a popover/sheet
 * does not.
 *
 * ── 503 degrade ───────────────────────────────────────────────────────────────────────────────
 * When the rates endpoint has never answered, the store's state is AMD-only. The trigger then
 * renders DISABLED with `֏` rather than disappearing: a control that vanishes reads as a broken
 * page, a disabled one reads as "unavailable right now".
 */
export function CurrencySwitch() {
  const { t, locale } = useLocale()
  const { rates, selectedCode, active, status, lastFetchedAt, isStale } = useCurrency()
  const isCompact = useIsCompactViewport()

  const listboxId = `${useId()}-currency`
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  const selectedIndex = rates.findIndex((rate) => rate.code === selectedCode)
  // The visitor's own choice, even during the load window when `active` is still AMD — the switcher
  // must show what they picked, `active` is only what the prices render in.
  const triggerRate = selectedIndex >= 0 ? rates[selectedIndex] : active
  const unavailable = status === 'error' && rates.length <= 1
  const amdRate = rates.find((rate) => rate.code === 'AMD')

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

  function rateNoteFor(rate: CurrencyRate): string {
    if (rate.code === 'AMD' || !amdRate) return t('currency.baseCurrency')
    return t('currency.rateNote', { code: rate.code, amount: formatMoney(rate.ratePerUnitAmd, amdRate, locale) })
  }

  function badgeClasses(selected: boolean, highlighted: boolean): string {
    const base = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-colors'
    if (selected) return `${base} bg-gold-fill text-gold-on`
    if (highlighted) return `${base} text-gold-ink ring-1 ring-gold-ink/50`
    // The sheet never sets `highlighted` (no roving state there) — `group-hover`/`group-focus-visible`
    // give its rows the same preview on tap-and-hold/keyboard focus that desktop gets from JS.
    return `${base} text-ink-dim ring-1 ring-edge group-hover:text-gold-ink group-hover:ring-gold-ink/50 group-focus-visible:text-gold-ink group-focus-visible:ring-gold-ink/50`
  }

  // Shared by both shells: the badge + code + rate line + checkmark. `highlighted` only ever comes
  // from the desktop panel's roving `activeIndex` — the sheet passes `false` and leans on its own
  // `hover:`/`focus-visible:` classes instead, since it has no separate "highlighted" state to track.
  function optionContent(rate: CurrencyRate, selected: boolean, highlighted: boolean) {
    return (
      <>
        <span aria-hidden="true" className={badgeClasses(selected, highlighted)}>
          {rate.symbol}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={[
              'text-sm transition-colors',
              selected || highlighted
                ? 'font-semibold text-gold-ink'
                : 'text-ink group-hover:text-gold-ink group-focus-visible:text-gold-ink',
            ].join(' ')}
          >
            {rate.code}
          </span>
          <span className="truncate text-[11px] text-ink-muted">{rateNoteFor(rate)}</span>
        </span>
        {selected && <CheckIcon size={15} className="shrink-0 text-gold-ink" />}
      </>
    )
  }

  const freshnessLine = isStale
    ? t('currency.rateStale')
    : lastFetchedAt > 0
      ? t('currency.updatedAt', {
          time: new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(lastFetchedAt)),
        })
      : null

  function renderFooter() {
    if (!freshnessLine) return null
    return <div className="mt-1 border-t border-edge/70 px-2.5 pt-1.5 text-[11px] text-ink-muted">{freshnessLine}</div>
  }

  function renderSheetOptions() {
    return (
      <ul role="listbox" id={listboxId} aria-label={t('currency.switchAriaLabel')} className="flex flex-col gap-0.5">
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
            tabIndex={0}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
            onClick={() => commit(index)}
            // `min-h-11` (44px, project touch-target rule) is a floor: two lines of text already
            // clear it, this only guards the AMD/base-currency row whose note is short.
            className="group flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gold-fill/10 focus-visible:bg-gold-fill/10 focus-visible:outline-none"
          >
            {optionContent(rate, index === selectedIndex, false)}
          </li>
        ))}
      </ul>
    )
  }

  function renderDesktopOptions() {
    return (
      <ul role="listbox" id={listboxId} aria-label={t('currency.switchAriaLabel')} className="flex flex-col gap-0.5">
        {rates.map((rate, index) => {
          const selected = index === selectedIndex
          const highlighted = index === activeIndex
          return (
            <li
              key={rate.code}
              id={optionIdFor(index)}
              role="option"
              aria-selected={selected}
              aria-label={t('currency.optionAriaLabel', { code: rate.code })}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
              className={[
                'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none',
                highlighted ? 'bg-gold-fill/10' : '',
              ].join(' ')}
            >
              {optionContent(rate, selected, highlighted)}
            </li>
          )
        })}
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
        // symbol (+ code, from `lg`) and its chevron — the header capsule is at its tightest at
        // 375px, which is exactly why the code label only shows up once that constraint is gone.
        className={[
          'icon-press relative inline-flex h-10 items-center justify-center rounded-full text-sm text-ink-dim ring-1 ring-edge hover:text-gold-ink disabled:cursor-not-allowed disabled:opacity-60',
          isCompact ? 'min-w-11 gap-1 px-2' : 'gap-1.5 px-3',
        ].join(' ')}
      >
        <span aria-hidden="true" className="w-4 shrink-0 text-center text-[13px]">
          {triggerRate.symbol}
        </span>
        {!isCompact && (
          <span className="w-8 shrink-0 text-center text-xs font-semibold tracking-wide">{triggerRate.code}</span>
        )}
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
            {renderSheetOptions()}
            {renderFooter()}
          </Sheet>,
          document.body,
        )
      ) : (
        <Popover
          open={open}
          onClose={close}
          anchorRef={triggerRef}
          // `origin-top-left` — the panel is left-aligned with the trigger (`Popover`'s own
          // placement rule), so the entrance scale should visibly grow from that corner, not from
          // its own centre (the default `transform-origin`), which read as detached from the button
          // that opened it.
          className="w-64 origin-top-left overflow-hidden rounded-2xl border border-edge/70 bg-panel/95 p-2 shadow-lg shadow-black/30 backdrop-blur-md"
        >
          <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-ink-muted">
            {t('currency.switchAriaLabel')}
          </div>
          {renderDesktopOptions()}
          {renderFooter()}
        </Popover>
      )}
    </div>
  )
}
