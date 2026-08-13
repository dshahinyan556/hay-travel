import { useLocale } from '@/shared/i18n/LocaleProvider'

export type AuthMode = 'login' | 'register'

interface AuthModeToggleProps {
  value: AuthMode
  onChange: (mode: AuthMode) => void
  /** Блокирует переключение, пока летит запрос. */
  disabled?: boolean
}

const MODES: readonly AuthMode[] = ['login', 'register']

/**
 * Segmented «Вход / Регистрация» switch with a sliding fill (Spec 005).
 *
 * ARIA is carried over verbatim from the previous inline toggle: `radiogroup` + `radio`, not
 * `tablist` — the two segments swap the CONTENT of one form, they are not two panels.
 *
 * The fill's position is `translateX(100%)` of its own width, not a measured
 * `getBoundingClientRect` offset: there are exactly two segments and they are equal (`flex-1`),
 * so measuring would be machinery whose only contribution is a chance to desync on resize.
 *
 * No `prefers-reduced-motion` branch is needed. `--dur-fast` (the slide) already collapses to 1ms
 * via the token block in index.css, and `--dur-micro` (the label tint) deliberately does not —
 * that is a colour swap, not travel. See the token comment in index.css ~line 260.
 */
export function AuthModeToggle({ value, onChange, disabled = false }: AuthModeToggleProps) {
  const { t } = useLocale()

  return (
    <div
      role="radiogroup"
      aria-label={t('auth.modeToggleLabel')}
      className="relative flex rounded-full p-[3px] ring-1 ring-edge"
    >
      <span
        aria-hidden
        className="absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-wine shadow-sm transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]"
        style={{ transform: value === 'register' ? 'translateX(100%)' : 'none' }}
      />
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          disabled={disabled}
          onClick={() => onChange(mode)}
          // `min-h-11` is the 44px tap target, not a decorative height. `z-[1]` keeps the label
          // above the sliding fill, which is painted first as a sibling.
          className={`relative z-[1] min-h-11 flex-1 rounded-full px-4 text-sm font-semibold transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] disabled:cursor-not-allowed ${
            value === mode ? 'text-gold-light' : 'text-ink-dim hover:text-gold-ink'
          }`}
        >
          {mode === 'login' ? t('auth.tabLogin') : t('auth.tabRegister')}
        </button>
      ))}
    </div>
  )
}
