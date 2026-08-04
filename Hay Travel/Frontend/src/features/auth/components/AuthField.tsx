/**
 * One labelled input on the auth screens.
 *
 * UNCONTROLLED on purpose. The phone field filters non-digits by rewriting `input.value` in an
 * `onInput` handler (native `maxLength` can't be used: it truncates the raw string BEFORE the
 * filter runs, so pasting "+374 55 123456" would lose the tail). React would fight that write on
 * a controlled input, so the forms read their values from `FormData` at submit time instead —
 * which also means typing never re-renders the form.
 *
 * Styling matches the public site's dark-luxury palette; the admin panel uses `shared/ui/Input`.
 */

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
  /** Strip everything but digits as the user types (and on paste), then clamp to `maxLength`. */
  onlyDigits?: boolean
  /** Field-level validation message, already translated. */
  error?: string
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
  onlyDigits,
  error,
}: AuthFieldProps) {
  const errorId = `${name}-error`

  return (
    <label className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={onlyDigits ? undefined : maxLength}
        minLength={minLength}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onInput={
          onlyDigits
            ? (e) => {
                const input = e.currentTarget
                input.value = input.value.replace(/\D/g, '').slice(0, maxLength)
              }
            : undefined
        }
        className={[
          'mt-1.5 w-full rounded-xl bg-panel-raised px-3.5 py-2.5 text-sm text-ink ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
          error ? 'ring-danger' : 'ring-edge-strong',
        ].join(' ')}
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  )
}
