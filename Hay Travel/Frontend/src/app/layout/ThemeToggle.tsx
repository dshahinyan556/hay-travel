import { useTheme } from '@/shared/hooks/useTheme'
import { MoonIcon, SunIcon } from '@/shared/ui/icons'

/**
 * Dark/light switch for the public site. All the mechanics (storage, DOM sync, resync on
 * visibility/tab change) live in `useTheme` — this component is presentation only.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={next === 'light' ? 'Светлая тема' : 'Тёмная тема'}
      // `before:-inset-0.5` grows the tap target to 44x44 CSS px on top of the visible 40x40
      // circle instead of enlarging it — an invisible hit-area expander, not a bigger button.
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-dim ring-1 ring-edge transition-colors before:absolute before:-inset-0.5 before:content-[''] hover:text-gold-ink"
    >
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}
