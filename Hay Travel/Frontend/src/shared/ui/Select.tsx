import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useIsCompactViewport } from '@/shared/hooks'
import { Popover } from './Popover'
import { Sheet, SHEET_SINGLE_DETENT } from './Sheet'
import { ChevronDownIcon, CheckIcon } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
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

  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const openAt = useCallback((index: number) => {
    setActiveIndex(index < 0 ? 0 : index)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const commit = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option || option.disabled) return
      onChange(option.value)
      setOpen(false)
      triggerRef.current?.focus()
    },
    [options, onChange],
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
  useEffect(() => {
    if (!open || !isCompact) return
    const index = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options)
    if (index >= 0) optionRefs.current[index]?.focus()
  }, [open, isCompact])

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options))
        return
      }
      setActiveIndex((current) => stepIndex(options, current, event.key === 'ArrowDown' ? 1 : -1))
      return
    }
    if (event.key === 'Home') {
      if (!open) return
      event.preventDefault()
      setActiveIndex(firstEnabledIndex(options))
      return
    }
    if (event.key === 'End') {
      if (!open) return
      event.preventDefault()
      setActiveIndex(lastEnabledIndex(options))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options))
      } else {
        commit(activeIndex)
      }
      return
    }
    if (isPrintableKey(event.key)) {
      // Typeahead. Closed mirrors a native `<select>`: jump the value immediately, no popup shown
      // — the trigger already displays the selected label, which is feedback enough. Open: move
      // the highlight only, Enter still commits.
      const from = open ? activeIndex : selectedIndex
      const match = findTypeaheadIndex(options, event.key, from)
      if (match < 0) return
      if (open) setActiveIndex(match)
      else onChange(options[match].value)
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
      optionRefs.current[stepIndex(options, index, 1)]?.focus()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      optionRefs.current[stepIndex(options, index, -1)]?.focus()
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      const first = firstEnabledIndex(options)
      if (first >= 0) optionRefs.current[first]?.focus()
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = lastEnabledIndex(options)
      if (last >= 0) optionRefs.current[last]?.focus()
      return
    }
    if (isPrintableKey(event.key)) {
      const match = findTypeaheadIndex(options, event.key, index)
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

  const panelClasses =
    surface === 'admin'
      ? 'overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg'
      : 'overflow-auto rounded-lg border border-edge-strong bg-panel-raised py-1 shadow-lg'

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

  // Desktop: activedescendant-driven, options are not individually focusable. Panel chrome
  // (border/bg/shadow) lives on `Popover`'s own wrapper via its `className`, not here — otherwise
  // the box would be drawn twice, nested.
  const comboboxList = (
    <ul role="listbox" id={listboxId} aria-label={dialogLabel}>
      {options.map((option, index) => (
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
          <span className="flex-1">{option.label}</span>
          {index === selectedIndex && <CheckIcon size={16} className="shrink-0" />}
        </li>
      ))}
    </ul>
  )

  // Compact viewport: real focus per option, roving via arrow keys, Tab just walks the list.
  const dialogList = (
    <ul role="listbox" aria-label={dialogLabel} className="overflow-auto">
      {options.map((option, index) => (
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
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && !isCompact ? optionIdFor(activeIndex) : undefined}
        aria-invalid={error || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (open) setOpen(false)
          else openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options))
        }}
        onKeyDown={handleTriggerKeyDown}
        onBlur={() => {
          // Desktop only: on the mobile sheet, focus deliberately moves off the trigger and into
          // the dialog, so a blur there must not close it. `Popover`'s own outside-pointerdown
          // and Escape handlers cover dismissal in that case instead.
          if (open && !isCompact) setOpen(false)
        }}
        className={triggerClasses}
      >
        <span className={`flex-1 truncate ${selectedOption ? '' : mutedTextClass}`}>
          {selectedOption?.label ?? placeholder}
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
          {dialogList}
        </Sheet>
      ) : (
        <Popover
          open={open}
          onClose={close}
          anchorRef={triggerRef}
          matchAnchorWidth
          className={`max-h-72 ${panelClasses}`}
        >
          {comboboxList}
        </Popover>
      )}
    </div>
  )
}
