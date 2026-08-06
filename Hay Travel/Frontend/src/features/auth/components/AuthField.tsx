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
 */

import { useState } from 'react'
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
  /** Field-level validation message, already translated. */
  error?: string
  /** Leading icon, already sized (e.g. `<UserIcon size={16} />`). Purely decorative — the icon
   * components themselves carry `aria-hidden`. */
  icon?: ReactNode
  /** Controlled show/hide, for a password field that shares ONE eye toggle with a sibling field
   * (e.g. register's password + confirm-password). Omit to keep this field's own independent
   * local toggle — every other password field on the auth screens still works that way. */
  revealed?: boolean
  onToggleRevealed?: () => void
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
  icon,
  revealed: revealedProp,
  onToggleRevealed,
}: AuthFieldProps) {
  const errorId = `${name}-error`
  const isPassword = type === 'password'
  const [localRevealed, setLocalRevealed] = useState(false)
  const isControlled = revealedProp !== undefined
  const revealed = isControlled ? revealedProp : localRevealed
  const toggleRevealed = onToggleRevealed ?? (() => setLocalRevealed((value) => !value))

  return (
    <label className="block">
      <span className="text-[11px] font-semibold tracking-[.14em] text-ink-muted uppercase">
        {label}
      </span>
      <div
        // `group` scopes the icon's focus colour to THIS control's own input (`group-focus-within`)
        // rather than the nearest ancestor with that class — there is no other `group` nested here.
        className={`group mt-1.5 flex h-[46px] items-center gap-2.5 rounded-xl bg-panel-raised px-3.5 ring-1 transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] focus-within:ring-2 focus-within:ring-focus ${
          error ? 'ring-danger' : 'ring-edge-strong hover:ring-gold-line'
        }`}
      >
        {icon && (
          <span className="shrink-0 text-ink-muted transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] group-focus-within:text-gold-ink">
            {icon}
          </span>
        )}
        <input
          name={name}
          type={isPassword ? (revealed ? 'text' : 'password') : type}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          minLength={minLength}
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        {isPassword && (
          <button
            type="button"
            onClick={toggleRevealed}
            aria-label={revealed ? 'Скрыть пароль' : 'Показать пароль'}
            aria-pressed={revealed}
            className="icon-press -mr-1 flex shrink-0 cursor-pointer items-center rounded-full p-1 text-ink-muted hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {revealed ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  )
}
