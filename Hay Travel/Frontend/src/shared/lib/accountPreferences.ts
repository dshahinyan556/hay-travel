/**
 * Мост между предпочтениями АККАУНТА (`api/Account/Preferences`) и четырьмя локальными
 * владельцами настроек: `shared/lib/theme`, `shared/lib/palette`, `shared/currency`,
 * `shared/lib/locale`.
 *
 * Задача одна: у залогиненного источник правды — сервер, у гостя — `localStorage`, и переключатели
 * в шапке сайта обязаны работать одинаково в обоих случаях, ничего не зная о том, кто их нажал.
 *
 * ── Почему это стор вне React ─────────────────────────────────────────────────────────────────
 * Тот же довод, что у `shared/auth` и `shared/currency` (ADR 007/009): подписчики живут в двух
 * независимых деревьях (`RootLayout` и `/admin`), а часть источников (сам стор валют, события
 * `localStorage`) вообще не React. Провайдер был бы обёрткой над этим же модулем, которую всё
 * равно пришлось бы монтировать дважды.
 *
 * ── Как устроена синхронизация ────────────────────────────────────────────────────────────────
 * Ни один переключатель НЕ вызывает этот модуль. Каждый по-прежнему пишет своему владельцу
 * (`chooseTheme`, `persistPaletteChoice`, `setCurrency`, `setLocale`), а модуль ПОДПИСАН на них
 * и отправляет результат на сервер сам. Так путь один и для шапки, и для раздела «Предпочтения»,
 * и для любого будущего места; и так не возникает цикла импортов `shared/lib/theme ⇄ этот модуль`.
 *
 * Дубли отсекаются СРАВНЕНИЕМ, а не флагами «сейчас применяю»: применение серверных настроек тоже
 * порождает те же события, но после него локальный снимок равен серверной модели, и отправлять
 * нечего. Флаг занятости пришлось бы снимать в `finally` четырёх разных путей и он бы однажды
 * залип.
 *
 * ── Где живёт клиент эндпоинта ────────────────────────────────────────────────────────────────
 * В `shared/auth/preferencesApi.ts`, а не внутри фичи кабинета — по тому же доводу, что записан
 * у соседнего `sessionsApi.ts`: DTO принадлежит ядру auth, и читают его обе поверхности. Иначе
 * получилось бы `shared → features`, а такого направления в проекте нет ни в одном модуле.
 */

import {
  getPreferences,
  updatePreferences,
  type UserPreferencesModel,
} from '@/shared/auth/preferencesApi'
import { getAuthState, subscribeAuth } from '@/shared/auth'
import {
  BASE_CURRENCY_CODE,
  clearCurrencyPreference,
  ensureRatesReady,
  getCurrencyState,
  setCurrency,
  subscribeCurrency,
} from '@/shared/currency'
import type { LanguageCode } from '@/shared/types/language'
import {
  DEFAULT_LOCALE,
  getStoredLocale,
  LANGUAGE_CODE_BY_LOCALE,
  LOCALE_BY_LANGUAGE_CODE,
  LOCALE_CHANGE_EVENT,
  notifyLocaleChanged,
  setStoredLocale,
} from './locale'
import {
  isPaletteId,
  PALETTE_CHOICE_EVENT,
  persistPaletteChoice,
  readPaletteChoice,
  type PaletteId,
} from './palette'
import {
  clearStoredTheme,
  notifyThemeChanged,
  persistTheme,
  readThemeChoice,
  THEME_SYNC_EVENT,
  type Theme,
} from './theme'

/* -------------------------------------------------------------------------- */
/*  State                                                                      */
/* -------------------------------------------------------------------------- */

export type AccountPreferencesStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Итог ПОСЛЕДНЕЙ записи. `null` — записей ещё не было. */
export type AccountPreferencesSave = 'saved' | 'failed'

export interface AccountPreferencesState {
  /** `idle` — гость либо ещё не начинали; трактовать как «неизвестно», а не как «пусто». */
  status: AccountPreferencesStatus
  /**
   * Полный набор, как его видит сервер. Три поля здесь могут быть `null`, и это НЕ «пусто», а
   * «личного выбора нет, следуй сайту» — см. шапку `shared/auth/preferencesApi.ts`.
   */
  model: UserPreferencesModel | null
  /** Запись в полёте. Интерфейс ей не блокируется — переключатель уже применён. */
  saving: boolean
  lastSave: AccountPreferencesSave | null
  /** Момент последней записи — по нему экран гасит подтверждение и различает две подряд. */
  lastSaveAt: number
  /** Чем именно ответил сервер на неудавшуюся запись; экран сам переводит это в текст. */
  saveError: unknown
}

const INITIAL: AccountPreferencesState = {
  status: 'idle',
  model: null,
  saving: false,
  lastSave: null,
  lastSaveAt: 0,
  saveError: null,
}

let state: AccountPreferencesState = INITIAL
const listeners = new Set<() => void>()

export function getAccountPreferencesState(): AccountPreferencesState {
  return state
}

export function subscribeAccountPreferences(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setState(next: AccountPreferencesState): void {
  state = next
  for (const listener of listeners) listener()
}

/* -------------------------------------------------------------------------- */
/*  Локальный снимок ⇄ серверная модель                                        */
/* -------------------------------------------------------------------------- */

/**
 * Четыре настройки в том виде, в каком они лежат в браузере ПРЯМО СЕЙЧАС.
 *
 * `theme`/`palette` — именно ВЫБОР (`null` = «не выбирал»), а не то, чем покрашен экран: сервер
 * различает эти два состояния, и схлопнув их здесь, мы бы навсегда превратили админский дефолт в
 * личный выбор при первом же сохранении чего угодно другого.
 */
interface LocalPreferences {
  theme: Theme | null
  palette: PaletteId | null
  currency: string
  language: LanguageCode
}

function readLocal(): LocalPreferences {
  return {
    theme: readThemeChoice(),
    palette: readPaletteChoice(),
    currency: getCurrencyState().selectedCode,
    language: LANGUAGE_CODE_BY_LOCALE[getStoredLocale()],
  }
}

function sameLocal(a: LocalPreferences, b: LocalPreferences): boolean {
  return (
    a.theme === b.theme &&
    a.palette === b.palette &&
    a.currency === b.currency &&
    a.language === b.language
  )
}

/** Серверная модель → локальный снимок. Неизвестные значения (переименованный пресет, чужая тема)
 *  деградируют в «выбора нет», а не оставляют экран без цвета. */
function localOf(model: UserPreferencesModel): LocalPreferences {
  return {
    theme: model.preferredTheme === 'dark' || model.preferredTheme === 'light' ? model.preferredTheme : null,
    palette: isPaletteId(model.preferredPalette) ? model.preferredPalette : null,
    currency: model.preferredCurrency ?? BASE_CURRENCY_CODE,
    language: model.preferredLanguage,
  }
}

/**
 * Локальный снимок → тело `PUT`. `base` нужен ровно ради `notificationChannels`: каналов нет
 * локального двойника, а `PUT` — полная перезапись, и не приложив их, мы бы обнулили маску.
 */
function modelOf(local: LocalPreferences, base: UserPreferencesModel): UserPreferencesModel {
  return {
    ...base,
    preferredTheme: local.theme,
    preferredPalette: local.palette,
    preferredCurrency: local.currency,
    preferredLanguage: local.language,
  }
}

/**
 * Раскладывает серверные настройки по владельцам.
 *
 * `data-theme`/`data-preset` здесь СОЗНАТЕЛЬНО не трогаются: пишутся хранилище и события, а
 * красят экран те, кто владеет атрибутами, — `useTheme` и `useSiteDesign`. Оба смонтированы
 * только на публичном сайте, поэтому в `/admin` (светлая teal-панель, пресетов не носит) ничего
 * не произойдёт само собой, без единой проверки пути. При этом хранилище будет заполнено, и
 * клиентский переход из панели на сайт сразу отдаст правильную тему и палитру.
 */
function applyLocally(local: LocalPreferences): void {
  if (local.theme === null) clearStoredTheme()
  else persistTheme(local.theme)

  // Само разошлёт `PALETTE_CHOICE_EVENT`.
  persistPaletteChoice(local.palette)
  notifyThemeChanged()

  setCurrency(local.currency)

  const locale = LOCALE_BY_LANGUAGE_CODE[local.language] ?? DEFAULT_LOCALE
  if (locale !== getStoredLocale()) {
    setStoredLocale(locale)
    notifyLocaleChanged()
  }
}

/* -------------------------------------------------------------------------- */
/*  Загрузка                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Пока `false`, локальные изменения на сервер НЕ уезжают.
 *
 * Окно между «сессия появилась» и «настройки приехали и применены» — единственное, где локальный
 * снимок и серверная модель законно расходятся. Отправлять в нём означало бы затирать настройки
 * аккаунта тем, что осталось в браузере от гостя.
 */
let armed = false
let hydration: Promise<AccountPreferencesState> | null = null

async function hydrate(): Promise<AccountPreferencesState> {
  setState({ ...state, status: 'loading' })

  // Снимок ДО запроса — с ним сравнивается снимок после, чтобы отличить «человек ничего не трогал»
  // от «человек щёлкнул переключателем в шапке, пока мы ждали ответ».
  const before = readLocal()

  let model: UserPreferencesModel
  try {
    model = await getPreferences()
  } catch {
    // Код ошибки здесь бесполезен: не загрузившиеся настройки — это не загрузившиеся настройки, и
    // единственное доступное человеку действие («Повторить») от кода не зависит.
    setState({ ...state, status: 'error', model: null })
    return state
  }

  // Курсы обязаны быть на месте до `setCurrency`: стор молча игнорирует код, которого нет в
  // таблице, и валюта аккаунта просто не применилась бы. Никогда не отклоняется.
  await ensureRatesReady()

  const after = readLocal()
  setState({ ...state, status: 'ready', model })

  /**
   * Аккаунт, в котором этого экрана ещё не касались: все три поля с личным выбором пусты.
   *
   * Такой аккаунт не может быть источником правды — правды в нём нет, есть отсутствие ответа. Взять
   * его буквально значило бы на ПЕРВОМ же входе сбросить человеку тему, валюту и язык, которыми он
   * пользовался гостем: сервер вернёт три `null` и `preferredLanguage: Russian` (его подставляет
   * бэкенд, регистрация язык не передаёт). После выкладки фичи в таком состоянии находятся ВСЕ
   * существующие аккаунты сразу, то есть это был бы не крайний случай, а поведение по умолчанию.
   * Поэтому первый вход переносит настройки браузера В аккаунт, а не наоборот.
   *
   * Дальше правило обычное: как только личный выбор в аккаунте появился, побеждает он — на втором
   * устройстве человек увидит то, что выбрал на первом.
   */
  const untouched =
    model.preferredTheme === null &&
    model.preferredPalette === null &&
    model.preferredCurrency === null

  // Человек успел переключить что-то, пока шёл запрос. Его нажатие важнее ответа: применить сейчас
  // серверный набор значило бы отменить то, что он только что увидел на экране.
  const touchedDuringLoad = !sameLocal(before, after)

  if (untouched || touchedDuringLoad) {
    armed = true
    // Совпало — отправлять нечего. Обычный случай чистого браузера и чистого аккаунта: без этой
    // проверки каждый первый вход стоил бы одного бессмысленного `PUT`.
    if (!sameLocal(after, localOf(model))) void push(after)
  } else {
    // `armed` поднимается ПОСЛЕ применения: события, которые оно порождает, прилетают по одному, и
    // на середине пути локальный снимок ещё не равен модели — вооружённый обработчик отправил бы
    // полуприменённый набор обратно на сервер.
    applyLocally(localOf(model))
    armed = true
  }

  return state
}

/**
 * Загрузить предпочтения текущей сессии. Single-flight, никогда не отклоняется: неудача — это
 * `status: 'error'`, а не исключение у вызывающего.
 */
export function ensureAccountPreferencesReady(): Promise<AccountPreferencesState> {
  if (hydration) return hydration
  if (!getAuthState().user) return Promise.resolve(state)
  hydration = hydrate()
  return hydration
}

/** Повторить загрузку после неудачи — единственный способ перезапустить её вручную. */
export function retryAccountPreferences(): Promise<AccountPreferencesState> {
  hydration = null
  return ensureAccountPreferencesReady()
}

/* -------------------------------------------------------------------------- */
/*  Запись                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Растёт на каждой записи. Ответ с устаревшим номером игнорируется, и запрос с устаревшим номером
 * до сети даже не доходит: три быстрых щелчка по переключателю должны оставить на сервере
 * последний набор, а не тот, чей ответ вернулся позже всех.
 */
let pushSeq = 0
/** Записи выстроены в цепочку, чтобы два `PUT` не переписывали один и тот же набор наперегонки. */
let pushChain: Promise<void> = Promise.resolve()

function push(local: LocalPreferences): Promise<void> {
  const base = state.model
  if (!base) return Promise.resolve()

  const next = modelOf(local, base)
  const seq = ++pushSeq

  // Оптимистично: переключатель уже применён на экране, и модель обязана совпадать с ним, иначе
  // следующее сравнение решит, что расхождение — это новое изменение, и отправит ещё раз.
  setState({ ...state, model: next, saving: true })

  pushChain = pushChain.then(async () => {
    if (seq !== pushSeq) return
    try {
      const saved = await updatePreferences(next)
      if (seq !== pushSeq) return
      setState({ ...state, model: saved, saving: false, lastSave: 'saved', lastSaveAt: Date.now(), saveError: null })
    } catch (err) {
      if (seq !== pushSeq) return
      // Картинку НЕ откатываем: человек видит то, что выбрал, и читает рядом, что сохранить не
      // удалось. Молчаливый откат выглядел бы как «переключатель не работает».
      setState({ ...state, saving: false, lastSave: 'failed', lastSaveAt: Date.now(), saveError: err })
    }
  })

  return pushChain
}

/**
 * Каналы уведомлений — единственная настройка без локального двойника, поэтому у неё явная
 * функция, а не подписка.
 *
 * Пустую маску сюда передавать нельзя: сервер ответит 2068, и это правильно, но объяснить человеку,
 * что нельзя остаться совсем без уведомлений, обязан экран — до запроса, а не после.
 */
export function setNotificationChannels(channels: number): Promise<void> {
  const base = state.model
  if (!base) return Promise.resolve()
  const next: UserPreferencesModel = { ...base, notificationChannels: channels }
  const seq = ++pushSeq

  setState({ ...state, model: next, saving: true })

  pushChain = pushChain.then(async () => {
    if (seq !== pushSeq) return
    try {
      const saved = await updatePreferences(next)
      if (seq !== pushSeq) return
      setState({ ...state, model: saved, saving: false, lastSave: 'saved', lastSaveAt: Date.now(), saveError: null })
    } catch (err) {
      if (seq !== pushSeq) return
      // Здесь откат ОБЯЗАТЕЛЕН, в отличие от темы/валюты: тумблер канала описывает не картинку, а
      // то, придёт ли человеку письмо. Оставить его в положении, которого сервер не принял, —
      // значит соврать о доставке.
      setState({ ...state, model: base, saving: false, lastSave: 'failed', lastSaveAt: Date.now(), saveError: err })
    }
  })

  return pushChain
}

/* -------------------------------------------------------------------------- */
/*  Жизненный цикл сессии                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Выход из аккаунта.
 *
 * Снимаются ровно те три ключа, которые заполняла загрузка предпочтений, — тема, палитра, валюта.
 * Оставить их значило бы отдать настройки аккаунта следующему гостю на общем устройстве. Побочно
 * теряется и собственный выбор гостя, сделанный до входа: отличить его от аккаунтского после
 * перезагрузки нечем, и ошибаться безопаснее в сторону дефолтов сайта.
 *
 * ЯЗЫК намеренно остаётся. Он единственный здесь отвечает не за внешний вид, а за понимание: сбросить
 * англоязычного человека в русский в момент выхода — это не «убрать чужое», а сделать сайт нечитаемым,
 * причём ничего личного о вышедшем язык страницы не сообщает. Плюс `hay-travel-locale` читают
 * загрузчики маршрутов вне React (`shared/api`), и его смена прямо во время ухода со страницы
 * означала бы лишний перезапрос содержимого по дороге.
 */
function forget(): void {
  armed = false
  hydration = null
  // Отменяет всё, что сейчас в полёте: ответы на запросы прежней сессии применять уже некуда.
  pushSeq += 1
  setState(INITIAL)

  clearStoredTheme()
  persistPaletteChoice(null)
  notifyThemeChanged()
  clearCurrencyPreference()
}

/**
 * Кто сейчас в сессии. Не булево «залогинен»: смена ЛИЧНОСТИ (вход под другим аккаунтом,
 * имперсонация) обязана перезагрузить настройки, а не оставить чужие.
 */
let currentUserId: number | null = null

function onAuthChanged(): void {
  const user = getAuthState().user

  if (user) {
    if (user.id === currentUserId) return
    currentUserId = user.id
    armed = false
    hydration = null
    void ensureAccountPreferencesReady()
    return
  }

  // Холодная загрузка гостя тоже приходит сюда с `user: null`, но `currentUserId` ещё null —
  // и это правильно: чистить нечего, локальные настройки гостя принадлежат ему.
  if (currentUserId !== null) {
    currentUserId = null
    forget()
  }
}

/** Что-то изменили локально — в шапке, в разделе «Предпочтения» или в панели. */
function onLocalChanged(): void {
  if (!armed) return
  const base = state.model
  if (!base) return

  const local = readLocal()
  if (sameLocal(local, localOf(base))) return
  void push(local)
}

let started = false

/**
 * Включает синхронизацию. Вызывается один раз из `main.tsx` — до первого рендера и одинаково для
 * публичного сайта и для `/admin`: язык уведомлений человек может сменить и в панели.
 *
 * Событие `storage` СОЗНАТЕЛЬНО не слушается. Соседняя вкладка уже отправила изменение сама;
 * повторная отправка отсюда была бы вторым `PUT` с тем же телом. Устареть от этого может только
 * `notificationChannels` в этой вкладке, а он всё равно перечитывается ответом ближайшей записи.
 */
export function startAccountPreferencesSync(): void {
  if (started || typeof window === 'undefined') return
  started = true

  subscribeAuth(onAuthChanged)
  // Сессия могла разрешиться раньше, чем сюда дошли: `ensureAuthReady` стартует в том же `main.tsx`.
  onAuthChanged()

  subscribeCurrency(onLocalChanged)
  window.addEventListener(THEME_SYNC_EVENT, onLocalChanged)
  window.addEventListener(PALETTE_CHOICE_EVENT, onLocalChanged)
  window.addEventListener(LOCALE_CHANGE_EVENT, onLocalChanged)
}
