import { useSyncExternalStore } from 'react'
import {
  getAccountPreferencesState,
  subscribeAccountPreferences,
  type AccountPreferencesState,
} from '@/shared/lib/accountPreferences'

/**
 * React-привязка к стору предпочтений аккаунта.
 *
 * Тот же примитив и по той же причине, что у `useAuth`/`useCurrency`: `useSyncExternalStore`
 * подписывается во время рендера, поэтому компонент не может отрисовать снимок, устаревший ещё
 * до его монтирования.
 *
 * Только чтение. Изменения идут не сюда, а владельцам настроек (`chooseTheme`,
 * `persistPaletteChoice`, `setCurrency`, `setLocale`) и в `setNotificationChannels` — стор
 * подписан на них сам.
 */
export function useAccountPreferences(): AccountPreferencesState {
  return useSyncExternalStore(
    subscribeAccountPreferences,
    getAccountPreferencesState,
    getAccountPreferencesState,
  )
}
