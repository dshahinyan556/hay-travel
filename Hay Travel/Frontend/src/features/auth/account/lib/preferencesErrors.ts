/**
 * Ключи словаря для отказов, которые умеет производить только `PUT api/Account/Preferences`.
 *
 * Отдельно от `accountErrors.ts` по той же причине, по которой тот отделён от
 * `shared/auth/authErrors.ts`: эти три кода не значат ничего нигде, кроме одного раздела, и
 * расширять ими общую карту — значит однажды показать «нельзя выключить оба канала» в форме входа.
 */

import { authErrorCodeOf } from '@/shared/auth'
import type { TranslationKey } from '@/shared/i18n/dictionary'

/** `GlobalErrorCode` в диапазоне предпочтений (`ATTours.Helper/Enums/GlobalErrorCode.cs`). */
export const PreferencesErrorCode = {
  /** Пустая маска каналов. Экран не должен доводить до этого кода — он объясняет запрет ДО
   *  запроса, — но код всё равно обрабатывается: маску можно обнулить и из другой вкладки. */
  NoNotificationChannels: 2068,
  /** Telegram включён, а чат к аккаунту не привязан. Здесь это тоже гонка между вкладками:
   *  тумблер недоступен, пока привязки нет. */
  TelegramChannelUnavailable: 2069,
  /** Неизвестная сервером палитра/валюта/тема — например, пресет, снятый админом с публикации,
   *  пока экран был открыт. */
  UnknownPreferenceValue: 2070,
} as const

export type PreferencesErrorCode = (typeof PreferencesErrorCode)[keyof typeof PreferencesErrorCode]

const CODE_TO_KEY: Record<number, TranslationKey> = {
  [PreferencesErrorCode.NoNotificationChannels]: 'account.pref.errorNoChannels',
  [PreferencesErrorCode.TelegramChannelUnavailable]: 'account.pref.errorTelegramUnavailable',
  [PreferencesErrorCode.UnknownPreferenceValue]: 'account.pref.errorUnknownValue',
}

/**
 * Что показать вместо «Настройки сохранены».
 *
 * Всё, кроме трёх кодов выше, схлопывается в одно сообщение — «не удалось сохранить, проверьте
 * связь». Общая карта `shared/auth` здесь СОЗНАТЕЛЬНО не используется, хотя `accountErrors.ts`
 * ею и заканчивается: её запасные варианты написаны для форм («проверьте введённые данные»,
 * «неверный логин или пароль»), а в этом разделе вводить нечего — есть переключатели, и
 * единственное осмысленное действие человека одно и то же при любой причине отказа.
 */
export function preferencesErrorMessageKey(err: unknown): TranslationKey {
  const code = authErrorCodeOf(err)
  if (code !== undefined && code in CODE_TO_KEY) return CODE_TO_KEY[code]
  return 'account.pref.saveFailed'
}
