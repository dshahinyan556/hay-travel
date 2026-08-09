import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useIsCompactViewport } from '@/shared/hooks'
import { Popover } from './Popover'
import { Sheet, SHEET_SINGLE_DETENT } from './Sheet'
import { ChevronDownIcon, CheckIcon } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  /**
   * Leading visual for the option row AND for the trigger when this option is selected — e.g. an
   * SVG country flag. Purely decorative: it must carry no information the `label` does not, since
   * it is rendered `aria-hidden` (the option's accessible name is its label).
   */
  icon?: ReactNode
  /**
   * What the TRIGGER shows when this option is selected, when that should be shorter than the list
   * label. The country picker uses it to show `+374` in a narrow trigger while the list still reads
   * «Армения +374». Falls back to `label`.
   */
  triggerLabel?: string
}

export interface SelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Shown in the trigger when `value` matches nothing in `options` (e.g. `''`). */
  placeholder?: string
  disabled?: boolean
  /** Marks the field as invalid: red border. Pair with `Field`'s `error` text. */
  error?: boolean
  /** Extra classes for the outer positioning wrapper (e.g. a width like `w-44`). */
  className?: string
  /**
   * Overrides the trigger's shape and spacing — border-radius, padding (`rounded-lg px-3 py-2` by
   * default). This REPLACES the default shape rather than appending to it, so a caller does not
   * need to fight Tailwind's `rounded-lg`/`rounded-full` (same specificity, last-in-stylesheet
   * wins — unpredictable when both are present in one class string). Colors (border, background,
   * text, focus ring, disabled state) and the 44px minimum tap target are never affected by this
   * prop — they stay on the component so `surface`'s two palettes cannot desync. Use this to make
   * a trigger a pill (`rounded-full px-3.5 py-2`) to sit flush in a row of pill-shaped controls.
   */
  triggerClassName?: string
  /**
   * Which palette to render in.
   *
   * The public site's dark/light skins are role tokens (`bg-panel`, `text-ink`, `ring-focus`, …)
   * that flip with the `data-theme` attribute on `<html>`. `/admin` never touches that attribute
   * and keeps its own light teal literals instead (`bg-white`, `border-neutral-300`, `brand-*` —
   * see the note above `--color-brand-*` in `index.css`). Reading `data-theme` to decide would be
   * wrong for admin: a visitor who switched the public site to its light skin earlier in the same
   * tab would leave `data-theme='light'` set, and an admin screen built on role tokens would
   * silently render in the PUBLIC light skin (parchment/wine) instead of admin teal. An explicit
   * prop makes the palette a decision each call site states, not something inferred from a global
   * that one of the two consumers doesn't even manage.
   */
  surface?: 'public' | 'admin'
  /**
   * Adds a text filter above the option list.
   *
   * Only worth it for genuinely long lists (the ~250-entry country picker) — for a three-option
   * role picker the built-in typeahead is better. Turning it on changes the a11y pattern from the
   * "select-only combobox" (focus stays on the trigger) to the EDITABLE combobox: focus moves into
   * the filter input while open, and the listbox is driven from there by `aria-activedescendant`.
   */
  searchable?: boolean
  /** Placeholder of the `searchable` filter input. Pass a localised string on the public site. */
  searchPlaceholder?: string
  /** Shown instead of the list when the filter matches nothing. */
  noResultsText?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

const TOUCH_TARGET = 'min-h-11'

/** Finds the next non-disabled option after `from`, wrapping around — used by typeahead. */
function findTypeaheadIndex(options: SelectOption[], query: string, from: number): number {
  const lower = query.toLowerCase()
  const n = options.length
  for (let step = 1; step <= n; step++) {
    const index = (from + step + n) % n
    if (!options[index].disabled && options[index].label.toLowerCase().startsWith(lower)) {
      return index
    }
  }
  return -1
}

/** One step in `delta`'s direction, skipping disabled options, clamped (does not wrap) at the ends. */
function stepIndex(options: SelectOption[], from: number, delta: 1 | -1): number {
  let i = from
  for (let steps = 0; steps < options.length; steps++) {
    i += delta
    if (i < 0 || i >= options.length) return from
    if (!options[i].disabled) return i
  }
  return from
}

function firstEnabledIndex(options: SelectOption[]): number {
  return options.findIndex((option) => !option.disabled)
}

function lastEnabledIndex(options: SelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) {
    if (!options[i].disabled) return i
  }
  return -1
}

function isPrintableKey(key: string): boolean {
  return key.length === 1 && key !== ' '
}

/**
 * Resolves the text content of the element `aria-labelledby` points to. Native `aria-labelledby`
 * on the trigger itself already gives the BUTTON its accessible name for free (forwarded straight
 * through as a DOM attribute below) — this is only for the two places that need a plain string
 * instead of an ID reference: the mobile sheet's `ariaLabel` prop/heading text, and the listbox's
 * own `aria-label` (a `role="listbox"` has no native-label mechanism of its own to fall back on).
 */
function useLabelledByText(id: string | undefined): string | undefined {
  const [text, setText] = useState<string | undefined>(() =>
    id ? (document.getElementById(id)?.textContent ?? undefined) : undefined,
  )
  useEffect(() => {
    setText(id ? (document.getElementById(id)?.textContent ?? undefined) : undefined)
  }, [id])
  return text
}

/**
 * Custom dropdown, built to replace both the native `<select>` in `/admin` and the native
 * `<select>` `ToursFilterBar` hand-rolls directly (see `docs/audit/bugs-2026-07-27.md` §3.1) — a
 * native `<select>`'s open list is drawn by the OS and cannot be styled, which is the whole
 * complaint this component exists to fix.
 *
 * ── Two different a11y patterns, by viewport ──────────────────────────────────────────────────
 * Desktop: the ARIA 1.2 "select-only combobox" pattern. The trigger is `role="combobox"`; focus
 * never leaves it. Arrow keys move a highlighted option via `aria-activedescendant`, exactly like
 * a native select's own dropdown. The popup is `shared/ui/Popover`.
 *
 * Compact viewport (`useIsCompactViewport`): a `shared/ui/Sheet` instead of a popover — see that
 * file's doc comment for why a bottom sheet beats trying to anchor a floating panel on a phone.
 * Opening it moves real focus into the dialog (consistent with every other overlay in this app —
 * `Modal`, `RegionSheet` — `useFocusTrap` always focuses the container first), so here each option
 * is a real, individually focusable list item instead of an activedescendant target: touch users
 * tap it directly, keyboard users Tab or arrow between them.
 *
 * Both modes render the same `role="listbox"`/`role="option"` markup and the same selection
 * logic; only how an option becomes "current" (highlighted vs. really focused) differs.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Выберите…',
  disabled = false,
  error = false,
  className = '',
  triggerClassName,
  surface = 'public',
  searchable = false,
  searchPlaceholder = 'Поиск…',
  noResultsText = 'Ничего не найдено',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: SelectProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const listboxId = `${controlId}-listbox`

  const isCompact = useIsCompactViewport()

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState('')

  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  /**
   * The list actually rendered. EVERY index below (`activeIndex`, `selectedIndex`, the refs array,
   * `commit`) refers to this array, not to `options` — mixing the two would commit the wrong option
   * the moment a filter is typed. The trigger is the one place that still reads the full list, so a
   * selected option filtered out of view is still displayed.
   */
  const shown = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!searchable || !trimmed) return options
    return options.filter((option) => option.label.toLowerCase().includes(trimmed))
  }, [options, query, searchable])

  const selectedIndex = shown.findIndex((option) => option.value === value)
  const selectedOption = options.find((option) => option.value === value)

  const openAt = useCallback((index: number) => {
    setQuery('')
    setActiveIndex(index < 0 ? 0 : index)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const commit = useCallback(
    (index: number) => {
      const option = shown[index]
      if (!option || option.disabled) return
      onChange(option.value)
      setOpen(false)
      setQuery('')
      triggerRef.current?.focus()
    },
    [shown, onChange],
  )

  // Keep the highlighted option in view while browsing with the keyboard (desktop only — the
  // mobile sheet's options are real focusable elements, the browser scrolls those into view on
  // its own when they receive focus).
  useEffect(() => {
    if (!open || isCompact) return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, isCompact, activeIndex])

  // Mobile only: land focus on the selected (or first) option as soon as the sheet opens, instead
  // of leaving it on the sheet's own container. `Sheet` is a child of `Select` here, so its own
  // `useFocusTrap` effect (which focuses that container) commits first; this effect runs after it
  // in the same commit and moves focus the rest of the way onto a real option — deliberately not
  // depending on `selectedIndex`/`options`, since this should fire once per open, not every time
  // the active option changes while browsing.
  //
  // When the list is `searchable` the filter input is the better landing spot: that is the control
  // the visitor came to use, and the on-screen keyboard opening straight away is the point.
  useEffect(() => {
    if (!open || !isCompact) return
    if (searchable) {
      searchRef.current?.focus()
      return
    }
    const index = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(shown)
    if (index >= 0) optionRefs.current[index]?.focus()
  }, [open, isCompact, searchable])

  // Desktop + `searchable`: the editable-combobox pattern — real focus lives in the filter input
  // while the popover is open (see `searchable`'s doc comment). Without `searchable` focus never
  // leaves the trigger and there is nothing to do here.
  useEffect(() => {
    if (!open || isCompact || !searchable) return
    searchRef.current?.focus()
  }, [open, isCompact, searchable])

  // A filter that shrinks the list can leave the highlight pointing past its end, or at an option
  // that scrolled out of the match set. Re-anchor it to the first match on every query change.
  useEffect(() => {
    if (!open) return
    const first = firstEnabledIndex(shown)
    setActiveIndex(first < 0 ? 0 : first)
    // Keyed on the QUERY, not on `shown`: re-anchoring whenever the options array's identity
    // changes would fight a caller that rebuilds its options on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  /** Arrow/Enter handling shared by the trigger (non-searchable) and the filter input. */
  function moveActive(delta: 1 | -1) {
    setActiveIndex((current) => stepIndex(shown, current, delta))
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (isCompact) {
        // Compact viewport: options are really focusable, so an arrow walks INTO the list rather
        // than moving a virtual highlight.
        const index = event.key === 'ArrowDown' ? firstEnabledIndex(shown) : lastEnabledIndex(shown)
        if (index >= 0) optionRefs.current[index]?.focus()
        return
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(activeIndex)
      return
    }
    if (event.key === 'Tab' && !isCompact) {
      // Focus is inside a portal at the end of the DOM, so letting Tab run would drop the visitor
      // somewhere unrelated. Close and hand focus back to the trigger, where Tab means what the
      // visitor expects.
      event.preventDefault()
      close()
      triggerRef.current?.focus()
    }
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(shown))
        return
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Home') {
      if (!open) return
      event.preventDefault()
      setActiveIndex(firstEnabledIndex(shown))
      return
    }
    if (event.key === 'End') {
      if (!open) return
      event.preventDefault()
      setActiveIndex(lastEnabledIndex(shown))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(shown))
      } else {
        commit(activeIndex)
      }
      return
    }
    if (isPrintableKey(event.key)) {
      if (searchable) {
        // A searchable list has no typeahead: the same keystroke is a filter query, which is
        // strictly more useful on a 250-item list. Opening seeds the filter with the key just
        // pressed so nothing is lost.
        if (!open) {
          event.preventDefault()
          openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(shown))
          setQuery(event.key)
        }
        return
      }
      // Typeahead. Closed mirrors a native `<select>`: jump the value immediately, no popup shown
      // — the trigger already displays the selected label, which is feedback enough. Open: move
      // the highlight only, Enter still commits.
      const from = open ? activeIndex : selectedIndex
      const match = findTypeaheadIndex(shown, event.key, from)
      if (match < 0) return
      if (open) setActiveIndex(match)
      else onChange(shown[match].value)
    }
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLLIElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      commit(index)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      optionRefs.current[stepIndex(shown, index, 1)]?.focus()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      // From the first option, an arrow up returns to the filter input rather than dead-ending.
      if (searchable && index === firstEnabledIndex(shown)) {
        searchRef.current?.focus()
        return
      }
      optionRefs.current[stepIndex(shown, index, -1)]?.focus()
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      const first = firstEnabledIndex(shown)
      if (first >= 0) optionRefs.current[first]?.focus()
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = lastEnabledIndex(shown)
      if (last >= 0) optionRefs.current[last]?.focus()
      return
    }
    if (isPrintableKey(event.key) && !searchable) {
      const match = findTypeaheadIndex(shown, event.key, index)
      if (match >= 0) optionRefs.current[match]?.focus()
    }
  }

  const mutedTextClass = surface === 'admin' ? 'text-neutral-400' : 'text-ink-muted'

  // Shape/spacing (border-radius, padding) and color are deliberately two separate class groups:
  // `triggerClassName` (if passed) replaces only `DEFAULT_TRIGGER_SHAPE` wholesale — never
  // appended alongside it — so a caller cannot end up with both `rounded-lg` and `rounded-full` in
  // the same class string fighting over the same specificity. `TRIGGER_BASE` (44px tap target,
  // flex layout, focus ring, disabled cursor) and the color group below are never overridable.
  const DEFAULT_TRIGGER_SHAPE = 'rounded-lg px-3 py-2'
  const TRIGGER_BASE = `relative flex w-full items-center gap-2 ${TOUCH_TARGET} text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed`
  const triggerColorClasses =
    surface === 'admin'
      ? `border bg-white text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400 ${
          error
            ? 'border-rose-500 focus-visible:border-rose-600 focus-visible:ring-rose-600/20'
            : 'border-neutral-300 hover:border-neutral-400 focus-visible:border-brand-600 focus-visible:ring-brand-600/20'
        }`
      : `border bg-panel-raised text-ink disabled:border-disabled-edge disabled:bg-disabled-bg disabled:text-disabled-ink ${
          error
            ? 'border-danger focus-visible:ring-danger'
            : 'border-edge-strong hover:border-gold-line focus-visible:ring-focus'
        }`
  const triggerClasses = `${TRIGGER_BASE} ${triggerClassName || DEFAULT_TRIGGER_SHAPE} ${triggerColorClasses}`

  // The scroll container differs between the two shapes: without a filter the panel itself
  // scrolls, with one the filter row must stay pinned while only the list moves.
  const panelChrome =
    surface === 'admin'
      ? 'rounded-lg border border-neutral-200 bg-white py-1 shadow-lg'
      : 'rounded-lg border border-edge-strong bg-panel-raised py-1 shadow-lg'
  const panelClasses = searchable
    ? `${panelChrome} flex flex-col overflow-hidden`
    : `${panelChrome} overflow-auto`

  function optionClasses(option: SelectOption, selected: boolean, highlighted: boolean): string {
    const base = `flex ${TOUCH_TARGET} w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors`
    if (option.disabled) {
      return `${base} cursor-not-allowed opacity-60 ${surface === 'admin' ? 'text-neutral-400' : 'text-ink-muted'}`
    }
    if (surface === 'admin') {
      return `${base} cursor-pointer ${
        selected ? 'bg-brand-50 font-semibold text-brand-800' : highlighted ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-900'
      } focus-visible:outline-none focus-visible:bg-neutral-100`
    }
    return `${base} cursor-pointer ${
      selected ? 'bg-accent-soft font-semibold text-gold-ink' : highlighted ? 'bg-accent-soft text-ink' : 'text-ink'
    } focus-visible:outline-none focus-visible:bg-accent-soft`
  }

  const optionIdFor = (index: number) => `${listboxId}-option-${index}`

  const labelledByText = useLabelledByText(ariaLabelledBy)
  const dialogLabel = labelledByText ?? ariaLabel ?? placeholder

  const searchInputClasses =
    surface === 'admin'
      ? 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-brand-600'
      : 'w-full rounded-lg border border-edge-strong bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-gold-line'

  /** The filter row. Rendered inside both popup shapes; `role="combobox"` moves onto it while the
   * list is open, which is the ARIA 1.2 editable-combobox arrangement. */
  const searchBox = searchable ? (
    <div className={`px-1 pb-2 ${isCompact ? '' : 'pt-1'}`}>
      <input
        ref={searchRef}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls={listboxId}
        aria-activedescendant={!isCompact && shown.length > 0 ? optionIdFor(activeIndex) : undefined}
        aria-label={dialogLabel}
        autoComplete="off"
        value={query}
        placeholder={searchPlaceholder}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={handleSearchKeyDown}
        className={searchInputClasses}
      />
    </div>
  ) : null

  const emptyState = (
    <p className={`px-3 py-3 text-sm ${mutedTextClass}`} role="status">
      {noResultsText}
    </p>
  )

  // Desktop: activedescendant-driven, options are not individually focusable. Panel chrome
  // (border/bg/shadow) lives on `Popover`'s own wrapper via its `className`, not here — otherwise
  // the box would be drawn twice, nested.
  const comboboxList = (
    <ul role="listbox" id={listboxId} aria-label={dialogLabel}>
      {shown.map((option, index) => (
        <li
          key={option.value}
          ref={(node) => {
            optionRefs.current[index] = node
          }}
          id={optionIdFor(index)}
          role="option"
          aria-selected={index === selectedIndex}
          aria-disabled={option.disabled || undefined}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => !option.disabled && setActiveIndex(index)}
          onClick={() => !option.disabled && commit(index)}
          className={optionClasses(option, index === selectedIndex, index === activeIndex)}
        >
          {option.icon && (
            <span aria-hidden="true" className="flex shrink-0 items-center">
              {option.icon}
            </span>
          )}
          <span className="flex-1">{option.label}</span>
          {index === selectedIndex && <CheckIcon size={16} className="shrink-0" />}
        </li>
      ))}
    </ul>
  )

  // Compact viewport: real focus per option, roving via arrow keys, Tab just walks the list.
  const dialogList = (
    <ul role="listbox" id={listboxId} aria-label={dialogLabel}>
      {shown.map((option, index) => (
        <li
          key={option.value}
          ref={(node) => {
            optionRefs.current[index] = node
          }}
          role="option"
          aria-selected={index === selectedIndex}
          aria-disabled={option.disabled || undefined}
          tabIndex={option.disabled ? -1 : 0}
          onKeyDown={(event) => handleOptionKeyDown(event, index)}
          onClick={() => !option.disabled && commit(index)}
          className={optionClasses(option, index === selectedIndex, false)}
        >
          {option.icon && (
            <span aria-hidden="true" className="flex shrink-0 items-center">
              {option.icon}
            </span>
          )}
          <span className="flex-1">{option.label}</span>
          {index === selectedIndex && <CheckIcon size={16} className="shrink-0" />}
        </li>
      ))}
    </ul>
  )

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        // When `searchable`, the filter input becomes the combobox that owns the listbox (focus
        // really moves there), so the trigger must not claim ownership of it as well — two elements
        // pointing an `aria-activedescendant` at the same list is ambiguous for a screen reader.
        aria-controls={open && !searchable ? listboxId : undefined}
        aria-activedescendant={
          open && !isCompact && !searchable ? optionIdFor(activeIndex) : undefined
        }
        aria-invalid={error || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (open) close()
          else openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(shown))
        }}
        onKeyDown={handleTriggerKeyDown}
        onBlur={() => {
          // Desktop only: on the mobile sheet, focus deliberately moves off the trigger and into
          // the dialog, so a blur there must not close it. `Popover`'s own outside-pointerdown
          // and Escape handlers cover dismissal in that case instead.
          //
          // A `searchable` list is the same situation on desktop: focus moves into the filter
          // input inside the popover, which blurs the trigger — closing here would make the list
          // impossible to use at all.
          if (open && !isCompact && !searchable) setOpen(false)
        }}
        className={triggerClasses}
      >
        {selectedOption?.icon && (
          <span aria-hidden="true" className="flex shrink-0 items-center">
            {selectedOption.icon}
          </span>
        )}
        <span className={`flex-1 truncate ${selectedOption ? '' : mutedTextClass}`}>
          {selectedOption ? (selectedOption.triggerLabel ?? selectedOption.label) : placeholder}
        </span>
        <ChevronDownIcon
          size={16}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${mutedTextClass}`}
        />
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={close} ariaLabel={dialogLabel} detents={SHEET_SINGLE_DETENT}>
          <div className={`px-1 pb-2 pt-1 text-sm font-semibold ${surface === 'admin' ? 'text-neutral-900' : 'text-ink'}`}>
            {dialogLabel}
          </div>
          {searchBox}
          {/* `data-sheet-scroll` hands vertical gestures that start here to the browser, so a long
              filtered list scrolls instead of dragging the sheet closed. Only for `searchable`
              lists: for the short ones every existing call site has, swipe-to-dismiss anywhere on
              the sheet is the better behaviour and stays untouched. */}
          <div
            {...(searchable ? { 'data-sheet-scroll': '' } : {})}
            className="min-h-0 flex-1 overflow-auto"
          >
            {shown.length === 0 ? emptyState : dialogList}
          </div>
        </Sheet>
      ) : (
        <Popover
          open={open}
          onClose={close}
          anchorRef={triggerRef}
          matchAnchorWidth
          className={`max-h-72 ${panelClasses}`}
        >
          {searchBox}
          {shown.length === 0 ? (
            emptyState
          ) : searchable ? (
            <div className="min-h-0 flex-1 overflow-auto">{comboboxList}</div>
          ) : (
            comboboxList
          )}
        </Popover>
      )}
    </div>
  )
}
