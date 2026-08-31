/**
 * `api/Account/Preferences` — личные предпочтения залогиненного (тема, палитра, валюта, язык,
 * каналы уведомлений).
 *
 * Зачем сервер, а не только `localStorage`: настройки, лежащие в браузере, привязаны к
 * устройству. Человек выбрал тёмную тему на ноутбуке — на телефоне он снова видит светлую. Гость
 * по-прежнему живёт на `localStorage` (ему просто негде хранить иначе), а у аккаунта появляется
 * источник правды, переезжающий между устройствами.
 *
 * ── Две вещи, на которых здесь легко ошибиться ────────────────────────────────────────────────
 *
 * 1. `null` В ОТВЕТЕ — это не «пусто», а «личного выбора нет, следуй дефолту сайта». Сервер
 *    сознательно НЕ подмешивает дефолты: фронт и так получает `theme.defaultMode` и
 *    `theme.activePalette` из публичных настроек, а различать «выбрано dark» и «выбора нет»
 *    обязательно — во втором случае экран должен продолжать следовать за админской сменой
 *    дефолта. Схлопнете `null` в конкретное значение при чтении — сломаете именно это.
 *
 * 2. `PUT` — ПОЛНАЯ ПЕРЕЗАПИСЬ, а не патч. `null` в поле значит «сбросить к дефолту сайта», а не
 *    «не менять». Поэтому отправлять надо весь набор целиком, даже когда человек тронул один
 *    переключатель: экран всегда держит полный набор в памяти.
 */

import { authFetch } from './authFetch'
import type { LanguageCode } from '@/shared/types/language'

/**
 * Каналы доставки уведомлений о заказах — битовые флаги, зеркало backend
 * `NotificationChannelFlags`. Именно флаги, а не выбор одного: человек может хотеть и письмо,
 * и Telegram сразу.
 */
export const NotificationChannel = {
  Email: 1,
  Telegram: 2,
} as const

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel]

/** `GET api/Account/Preferences`. Три nullable поля — см. пункт 1 в шапке модуля. */
export interface UserPreferencesModel {
  /** `'dark'` / `'light'`; `null` — следовать `theme.defaultMode` сайта. */
  preferredTheme: string | null
  /** Id пресета палитры; `null` — следовать `theme.activePalette` сайта. */
  preferredPalette: string | null
  /** Код валюты ISO-4217; `null` — базовая валюта каталога. */
  preferredCurrency: string | null
  /** Не nullable: «выбора нет» для языка состоянием не является. Он же — язык уведомлений. */
  preferredLanguage: LanguageCode
  /** Битовая маска `NotificationChannel`. Ноль сервер не примет: без каналов человек перестанет
   *  узнавать о собственном заказе (код ошибки 2068). */
  notificationChannels: number
}

/** Тело `PUT`. Тип тот же, что у ответа, — и это ровно то, что нужно: отправляется весь набор. */
export type UpdatePreferencesModel = UserPreferencesModel

export function getPreferences(): Promise<UserPreferencesModel> {
  return authFetch<UserPreferencesModel>('api/Account/Preferences')
}

/**
 * Полная перезапись. Никаких «частичных» вызовов: передавайте набор, который экран сейчас
 * показывает, с изменённым полем.
 *
 * Сервер отвергнет: пустую маску каналов (2068), включённый Telegram без привязанного чата
 * (2069), неизвестную палитру/валюту/тему (2070).
 */
export function updatePreferences(model: UpdatePreferencesModel): Promise<UserPreferencesModel> {
  return authFetch<UserPreferencesModel>('api/Account/Preferences', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** Включён ли канал в маске. Вынесено, чтобы побитовая арифметика не расползлась по компонентам. */
export function hasChannel(channels: number, channel: NotificationChannel): boolean {
  return (channels & channel) !== 0
}

/**
 * Включить/выключить канал в маске. Возвращает НОВУЮ маску — вызывающий сам решает, что делать
 * с нулевой: это не техническая ошибка, а осмысленный отказ, о котором надо сказать человеку
 * словами, а не молча вернуть прежнее значение.
 */
export function withChannel(channels: number, channel: NotificationChannel, enabled: boolean): number {
  return enabled ? channels | channel : channels & ~channel
}
