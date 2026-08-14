/**
 * One labelled input on the auth screens.
 *
 * UNCONTROLLED on purpose (still true after the F1 redesign): typing never re-renders the form —
 * values are read from `FormData` at submit time. The password field's show/hide toggle is the
 * one bit of local state this component owns; it only ever flips the underlying `<input>`'s
 * `type` and the eye icon, never touches `.value`, so it does not fight the uncontrolled input.
 *
 * Styling matches the public site's dark-luxury palette (role tokens — `bg-panel-raised`,
 * `ring-edge-strong`, `text-gold-ink`, …); the admin panel uses `shared/ui/Input`.
 *
 * ── Floating label + own validation (2026-08-14) ─────────────────────────────────────────────
 * The caption used to sit as a fixed line above the box; it is now the resting placeholder INSIDE
 * the box and rises to a small label above it on focus or once the field has a value — pure CSS
 * (`peer`/`:placeholder-shown`), no state: the input needs a real (space) `placeholder` for
 * `:placeholder-shown` to toggle, and the label reacts to `peer-focus`/
 * `peer-[:not(:placeholder-shown)]`.
 *
 * `required` no longer relies on the browser's own validation bubble — every enclosing `<form>`
 * now carries `noValidate` (their own files), and this component owns the message instead:
 * `checkValidity()` on blur decides WHY the field is invalid (empty vs. wrong shape) and picks a
 * Russian message from `AUTH_FIELD_ERRORS`, shown through the exact same `error` slot a
 * server-side error already used. That self-generated message clears the moment the value
 * becomes valid again — re-checked on every keystroke, but only once the field has been touched,
 * so nothing red flashes before the visitor has had a chance to type.
 */

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { EyeIcon, EyeOffIcon } from '@/shared/ui/icons'

interface AuthFieldProps {
  /** `FormData` key — the forms read values by name at submit. */
  name: string
  label: string
  type: string
  autoComplete: string
  /** Defaults to true; pass `false` for genuinely optional fields (last name). */
  required?: boolean
  inputMode?: 'numeric' | 'tel' | 'text' | 'email'
  maxLength?: number
  minLength?: number
  defaultValue?: string
  autoFocus?: boolean
  /** Field-level validation message, already translated. Wins over the field's own
   * blur-generated message — it reflects the freshest submit attempt (e.g. "неверный пароль"),
   * which is more relevant than a generic "заполните это поле". */
  error?: string
  /**
   * Визуальная отметка «поле участвует в ошибке уровня формы» (неверный логин/пароль).
   * В отличие от `error`, своего текста не даёт: сообщение живёт в общей плашке над формой.
   * Красная рамка + `aria-invalid`, без `aria-describedby`.
   */
  invalid?: boolean
  /** Leading icon, already sized (e.g. `<UserIcon size={16} />`). Purely decorative — the icon
   * components themselves carry `aria-hidden`. */
  icon?: ReactNode
  /** Controlled show/hide, for a password field that shares ONE eye toggle with a sibling field
   * (e.g. register's password + confirm-password). Omit to keep this field's own independent
   * local toggle — every other password field on the auth screens still works that way. */
  revealed?: boolean
  onToggleRevealed?: () => void
}

/** Russian message per `ValidityState` flag that can fire here — the shapes this component's
 * callers actually use (`required`, `type="email"`, `minLength`/`maxLength`). Order matters:
 * `valueMissing` is checked first, since an empty field also reads `typeMismatch`/`tooShort` as
 * false (there is nothing to mismatch or be too short), but is checked FIRST here regardless, to
 * document that precedence rather than lean on it implicitly. */
function ownValidationMessage(input: HTMLInputElement): string | null {
  const validity = input.validity
  if (validity.valid) return null
  if (validity.valueMissing) return 'Заполните это поле.'
  if (validity.typeMismatch) return input.type === 'email' ? 'Введите email в формате имя@домен.' : 'Проверьте формат.'
  if (validity.tooShort) return `Минимум ${input.minLength} символов.`
  if (validity.tooLong) return `Максимум ${input.maxLength} символов.`
  return 'Проверьте это поле.'
}

export function AuthField({
  name,
  label,
  type,
  autoComplete,
  required = true,
  inputMode,
  maxLength,
  minLength,
  defaultValue,
  autoFocus,
  error,
  invalid = false,
  icon,
  revealed: revealedProp,
  onToggleRevealed,
}: AuthFieldProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const isPassword = type === 'password'
  const [touched, setTouched] = useState(false)
  const [ownError, setOwnError] = useState<string | null>(null)
  // `error` (server/form-level) always wins over the field's own blur-generated message — see
  // the prop's doc comment.
  const displayError = error ?? ownError ?? undefined
  const isFaulty = Boolean(displayError) || invalid
  const [localRevealed, setLocalRevealed] = useState(false)
  const isControlled = revealedProp !== undefined
  const revealed = isControlled ? revealedProp : localRevealed
  const toggleRevealed = onToggleRevealed ?? (() => setLocalRevealed((value) => !value))

  return (
    <div className="block">
      <div
        // `group` scopes the icon's focus colour to THIS control's own input (`group-focus-within`)
        // rather than the nearest ancestor with that class — there is no other `group` nested here.
        className={`group flex h-[60px] items-center gap-2.5 rounded-xl bg-panel-raised px-3.5 ring-1 transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus-within:ring-2 focus-within:ring-focus ${
          isFaulty ? 'ring-danger' : 'ring-edge-strong hover:ring-gold-line'
        }`}
      >
        {icon && (
          <span
            className={`shrink-0 transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] group-focus-within:text-gold-ink ${
              isFaulty ? 'text-danger' : 'text-ink-muted'
            }`}
          >
            {icon}
          </span>
        )}
        {/* Relative anchor for the floating label — `self-stretch` opts this one child back into
            filling the row's height despite the row's own `items-center`, which is what lets the
            label's resting `top-1/2` measure against the FULL row instead of the input's own
            (shorter, content-sized) box. */}
        <div className="relative min-w-0 flex-1 self-stretch">
          <input
            id={inputId}
            name={name}
            type={isPassword ? (revealed ? 'text' : 'password') : type}
            required={required}
            autoComplete={autoComplete}
            inputMode={inputMode}
            maxLength={maxLength}
            minLength={minLength}
            defaultValue={defaultValue}
            autoFocus={autoFocus}
            // A single space, not `""`: `:placeholder-shown` only ever matches a NON-empty
            // placeholder in some engines, and an empty one would leave the label permanently
            // floated (or permanently resting) regardless of the actual value.
            placeholder=" "
            aria-invalid={isFaulty ? true : undefined}
            aria-describedby={displayError ? errorId : undefined}
            onBlur={(event) => {
              setTouched(true)
              setOwnError(ownValidationMessage(event.currentTarget))
            }}
            onInput={(event) => {
              // Re-validate live only after the first blur — revalidating an untouched field on
              // every keystroke would flash red the instant someone starts typing into an empty
              // required box.
              if (touched) setOwnError(ownValidationMessage(event.currentTarget))
            }}
            className="peer h-full w-full bg-transparent pt-[27px] pb-[8px] text-sm text-ink outline-none"
          />
          <label
            htmlFor={inputId}
            // Floated zone (top 7–21px) and the input's own text (starts at `pt-[27px]`) need a
            // REAL measured gap, not just non-overlapping numbers on paper — the first cut
            // (top-13px float over pt-18px text) measured under 1px apart live and read as
            // merged. `top-[7px]` + `pt-[27px]` on a 60px row leaves ~6px of clear air.
            className={`pointer-events-none absolute top-1/2 left-0 origin-left -translate-y-1/2 text-sm transition-all duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] peer-focus:top-[7px] peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:tracking-[.08em] peer-focus:uppercase peer-[:not(:placeholder-shown)]:top-[7px] peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:tracking-[.08em] peer-[:not(:placeholder-shown)]:uppercase ${
              isFaulty ? 'text-danger' : 'text-ink-muted peer-focus:text-gold-ink'
            }`}
          >
            {label}
          </label>
        </div>
        {isPassword && (
          <button
            type="button"
            onClick={toggleRevealed}
            aria-label={revealed ? 'Скрыть пароль' : 'Показать пароль'}
            aria-pressed={revealed}
            // `before:-inset-2.5` grows the tap target to 44×44 CSS px around the visible glyph
            // instead of enlarging the button itself — the same invisible hit-area expander
            // `ThemeToggle` uses, so the icon stays the size the layout was drawn for.
            className="icon-press relative -mr-1 flex shrink-0 cursor-pointer items-center rounded-full p-1 text-ink-muted before:absolute before:-inset-2.5 before:content-[''] hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {revealed ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
          </button>
        )}
      </div>
      {displayError && (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {displayError}
        </span>
      )}
    </div>
  )
}
