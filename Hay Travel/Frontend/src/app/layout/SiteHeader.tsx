import type { NavStyle } from '@/shared/lib/navStyle'
import { Header } from './Header'
import { FrostedRailHeader } from './frosted/FrostedRailHeader'

export interface SiteHeaderProps {
  /** Вариант из `theme.navStyle` (админка → Настройки). См. `shared/lib/navStyle.ts`. */
  variant: NavStyle
}

/**
 * Точка ветвления шапки публичного сайта — ровно одна на весь проект.
 *
 * Тонкая обёртка без собственной разметки: варианты не «настраиваются» друг из друга, они
 * взаимоисключающие и каждый владеет своей вёрсткой целиком (`Header` — плавающая капсула,
 * `FrostedRailHeader` — «Стеклянная лента»). Отдельный компонент, а не тернарник в `RootLayout`,
 * чтобы точка выбора имела имя и её было видно в дереве компонентов.
 */
export function SiteHeader({ variant }: SiteHeaderProps) {
  return variant === 'rail' ? <FrostedRailHeader /> : <Header />
}
