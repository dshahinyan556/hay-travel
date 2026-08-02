import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Input } from './Input'
import type { InputProps } from './Input'
import { Popover } from './Popover'

export interface SuggestInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  /** Fired when the user picks a suggestion (click or Enter on a highlighted option). */
  onPick: (label: string) => void
  /** Candidate labels — e.g. existing catalog entry names. Free typing is always still allowed. */
  suggestions: string[]
}

/**
 * A plain text `Input` with a filtered suggestion list underneath it (ARIA 1.2 editable combobox
 * pattern: `role="combobox"` on the input itself, not `Select`'s button-trigger "select-only"
 * variant — see that file's doc comment for why the two are different patterns). Typing never
 * changes anything by itself; picking a suggestion is a shortcut the caller decides the meaning
 * of (e.g. filling a sibling field too), the value stays freely editable either way.
 *
 * Reuses `Popover` for the floating panel, mirroring the exact interaction (`onMouseDown`
 * preventDefault so the click doesn't blur the input first, then `onClick` commits) `Select`
 * already uses for its own desktop listbox.
 */
export function SuggestInput({
  value,
  onChange,
  onPick,
  suggestions,
  ...inputProps
}: SuggestInputProps) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = `${useId()}-suggestions`

  const query = value.trim().toLowerCase()
  const matches = (
    query === '' ? suggestions : suggestions.filter((s) => s.toLowerCase().includes(query))
  ).slice(0, 20)
  const showList = open && matches.length > 0
  const activeIndex = Math.min(highlighted, matches.length - 1)

  const pick = (label: string) => {
    onPick(label)
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((h) => Math.min(h + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      if (matches[activeIndex]) {
        event.preventDefault()
        pick(matches[activeIndex])
      }
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={showList ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
        {...inputProps}
      />
      <Popover open={showList} onClose={() => setOpen(false)} anchorRef={inputRef} matchAnchorWidth>
        <ul
          id={listboxId}
          role="listbox"
          className="max-h-56 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {matches.map((label, index) => (
            <li
              key={label}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => pick(label)}
              className={`block cursor-pointer truncate px-3 py-2 text-left text-sm transition-colors ${
                index === activeIndex ? 'bg-brand-50 text-brand-800' : 'text-neutral-900'
              }`}
            >
              {label}
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  )
}
