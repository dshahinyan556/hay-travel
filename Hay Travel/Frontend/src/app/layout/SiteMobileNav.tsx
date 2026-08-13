import type { NavStyle } from '@/shared/lib/navStyle'
import { MobileTabBar } from './MobileTabBar'
import { FrostedRailDock } from './frosted/FrostedRailDock'

export interface SiteMobileNavProps {
  /** Вариант из `theme.navStyle` (админка → Настройки). См. `shared/lib/navStyle.ts`. */
  variant: NavStyle
}

/**
 * Пара к `SiteHeader` для нижней навигации: `MobileTabBar` (плавающая капсула) либо
 * `FrostedRailDock` (док во всю ширину). Оба сами прячутся с `lg`, так что обёртка про
 * брейкпоинты ничего не знает.
 */
export function SiteMobileNav({ variant }: SiteMobileNavProps) {
  return variant === 'rail' ? <FrostedRailDock /> : <MobileTabBar />
}
