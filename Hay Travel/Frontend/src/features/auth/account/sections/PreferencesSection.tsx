import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getThemeSettings } from '@/shared/api/siteSettings'
import { useAuth } from '@/shared/auth'
import { setCurrency, useCurrency } from '@/shared/currency'
import { useAccountPreferences } from '@/shared/hooks'
import { useTheme } from '@/shared/hooks/useTheme'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  ensureAccountPreferencesReady,
  retryAccountPreferences,
  setNotificationChannels,
} from '@/shared/lib/accountPreferences'
import { LOCALES } from '@/shared/lib/locale'
import { isPaletteId, persistPaletteChoice, readSitePalette, type PaletteId } from '@/shared/lib/palette'
import type { Theme } from '@/shared/lib/theme'
import { AlertIcon, TelegramIcon } from '@/shared/ui/icons'
import { AuthError } from '../../components/AuthShell'
import {
  hasChannel,
  withChannel,
  NotificationChannel,
} from '@/shared/auth/preferencesApi'
import { getTelegramStatus, type TelegramLinkStatusModel } from '../api/telegram'
import { AccountSectionHead } from '../components/AccountSectionHead'
import { AccountStatePanel } from '../components/AccountStatePanel'
import { PaletteChoice } from '../components/PaletteChoice'
import { PreferenceRow } from '../components/PreferenceRow'
import { PreferenceSegments } from '../components/PreferenceSegments'
import { PreferenceSwitch } from '../components/PreferenceSwitch'
import { accountButtonClass } from '../lib/accountButton'
import { preferencesErrorMessageKey } from '../lib/preferencesErrors'

/**
 * Раздел «Предпочтения» — как сайт выглядит и на каком языке говорит лично с этим человеком.
 *
 * ── Что здесь на самом деле происходит ────────────────────────────────────────────────────────
 * Раздел почти ничего не хранит. Тема, палитра, валюта и язык принадлежат своим владельцам
 * (`useTheme`, `shared/lib/palette`, `shared/currency`, `LocaleProvider`), и переключатели здесь
 * зовут ровно тех же владельцев, что и переключатели в шапке. На сервер это уезжает не отсюда, а
 * из `shared/lib/accountPreferences`, который на этих владельцев подписан. Поэтому «шапка» и
 * «кабинет» не могут разъехаться: путь один, и второго нет.
 *
 * Свои у раздела только каналы уведомлений — у них нет локального двойника, и они единственные
 * ходят на сервер явным вызовом.
 *
 * ── Почему нет кнопки «Сохранить» и нет подтверждения «Сохранено» ────────────────────────────
 * Тема и палитра применяются на глазах — это и есть подтверждение. Отдельная плашка «Настройки
 * сохранены» после каждого переключения только раздражала (решение Давида 2026-08-31): ошибку
 * сохранения по-прежнему нужно показать (ниже), а успех — нет, он уже виден на экране.
 *
 * ── Три запроса, а не два ─────────────────────────────────────────────────────────────────────
 * Раздел грузит статус Telegram сам, хотя `accountLoader` уже получил его для «Подключений»:
 * контракт раздела — без пропсов, разделы размонтируются при уходе, и тянуть сюда чужое состояние
 * через страницу значило бы связать два независимых раздела ради одной строки. Дизайн-настройки
 * сайта (`GetPublic?group=7`) нужны, чтобы честно сказать, какая тема и палитра сейчас дефолтные.
 */
export function PreferencesSection() {
  const { t, locale, setLocale } = useLocale()
  const { user } = useAuth()
  const { theme, chooseTheme } = useTheme()
  const { rates, selectedCode, status: ratesStatus } = useCurrency()
  const { status, model, lastSave, saveError } = useAccountPreferences()
  const [searchParams] = useSearchParams()

  /** `null` — запрос не удался. Это НЕ «не привязан»: утверждать, что привязки нет, когда мы
   *  просто не смогли спросить, — значит выдать догадку за факт (то же правило, что в
   *  «Подключениях»). */
  const [telegram, setTelegram] = useState<TelegramLinkStatusModel | null>(null)
  /** Активный пресет сайта — на что сравнивать личный выбор палитры. */
  const [sitePalette, setSitePalette] = useState<PaletteId>(readSitePalette)
  const [extrasLoaded, setExtrasLoaded] = useState(false)

  /** Попытка выключить последний канал. Не ошибка сервера — до сервера мы её не доводим. */
  const [lastChannelBlocked, setLastChannelBlocked] = useState(false)

  useEffect(() => {
    // Идемпотентно: обычно набор уже приехал (стор подписан на сессию и стартует в `main.tsx`),
    // но раздел может быть открыт и по прямой ссылке до того, как это случилось.
    void ensureAccountPreferencesReady()
  }, [])

  useEffect(() => {
    let cancelled = false
    // Параллельно — запросы независимы. `getThemeSettings` не отклоняется никогда (отдаёт пустые
    // строки), поэтому `.catch` только у Telegram.
    void Promise.all([getTelegramStatus().catch(() => null), getThemeSettings()]).then(
      ([status, design]) => {
        if (cancelled) return
        setTelegram(status)
        // Неизвестный/пустой ответ — остаёмся на последнем известном пресете из кэша, а не
        // объявляем дефолтом обсидиан, которым он может и не быть.
        if (isPaletteId(design.activePalette)) setSitePalette(design.activePalette)
        setExtrasLoaded(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  /** Остальные параметры адреса переносятся как есть: кто-то положил их туда намеренно, и уход в
   *  «Подключения» — не повод их потерять (то же правило, что у рельса в `AccountPage`). */
  const connectionsHref = useMemo(() => {
    const next = new URLSearchParams(searchParams)
    next.set('section', 'connections')
    return `?${next.toString()}`
  }, [searchParams])

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <AccountSectionHead title={t('account.sectionPreferences')} />
        <AccountStatePanel
          tone="danger"
          title={t('account.pref.loadFailedTitle')}
          body={t('account.pref.loadFailedBody')}
        >
          <button
            type="button"
            onClick={() => void retryAccountPreferences()}
            className={accountButtonClass('ghost')}
          >
            {t('account.pref.retry')}
          </button>
        </AccountStatePanel>
      </div>
    )
  }

  if (model === null || !extrasLoaded) {
    return (
      <div className="flex flex-col gap-4">
        <AccountSectionHead title={t('account.sectionPreferences')} />
        <PreferencesSkeleton label={t('account.pref.loading')} />
      </div>
    )
  }

  const channels = model.notificationChannels
  const emailOn = hasChannel(channels, NotificationChannel.Email)
  const telegramOn = hasChannel(channels, NotificationChannel.Telegram)
  const telegramLinked = telegram?.isLinked === true
  /** Тумблер Telegram недоступен и когда привязки нет, и когда мы не смогли о ней спросить —
   *  разрешать включение канала, про который неизвестно, доставит ли он, нельзя. Тексты у двух
   *  случаев разные: «не привязан» — это факт, «не удалось проверить» — отсутствие знания. */
  const telegramDisabled = !telegramLinked

  function changeChannel(channel: NotificationChannel, enabled: boolean) {
    const next = withChannel(channels, channel, enabled)
    if (next === 0) {
      // Осмысленный отказ, а не техническая ошибка: сервер ответил бы 2068, но объяснить это
      // словами обязан экран — до запроса, а не после.
      setLastChannelBlocked(true)
      return
    }
    setLastChannelBlocked(false)
    void setNotificationChannels(next)
  }

  const currencyUnavailable = ratesStatus === 'error' && rates.length <= 1

  return (
    <div className="flex flex-col gap-4">
      <AccountSectionHead title={t('account.sectionPreferences')} />

      {/* ── Внешний вид и язык ── */}
      <div className="flex flex-col gap-4 rounded-2xl bg-panel-raised px-4 py-4 ring-1 ring-edge sm:px-5">
        <PreferenceRow label={t('account.pref.theme')}>
          <PreferenceSegments<Theme>
            value={theme}
            onChange={chooseTheme}
            options={[
              { value: 'dark', label: t('account.pref.themeDark') },
              { value: 'light', label: t('account.pref.themeLight') },
            ]}
          />
        </PreferenceRow>

        <div className="h-px bg-edge" />

        {/* Палитра стоит блоком, а не строкой: две карточки с образцом и подписью не помещаются
            справа от заголовка даже на десктопе, а ужатые до «кружок + слово» перестают быть тем,
            ради чего образец нужен. */}
        <div>
          <p className="mb-2.5 text-sm font-semibold text-ink">{t('account.pref.palette')}</p>
          <PaletteChoice
            value={isPaletteId(model.preferredPalette) ? model.preferredPalette : null}
            sitePalette={sitePalette}
            theme={theme}
            onChange={persistPaletteChoice}
          />
        </div>

        <div className="h-px bg-edge" />

        <PreferenceRow label={t('account.pref.currency')}>
          <PreferenceSegments
            value={selectedCode}
            onChange={setCurrency}
            disabled={currencyUnavailable}
            options={rates.map((rate) => ({
              value: rate.code,
              label: `${rate.symbol} ${rate.code}`,
              srLabel: rate.code,
            }))}
          />
        </PreferenceRow>

        <div className="h-px bg-edge" />

        <PreferenceRow label={t('account.pref.language')}>
          <PreferenceSegments
            value={locale}
            onChange={setLocale}
            options={LOCALES.map((item) => ({ value: item.code, label: item.name }))}
          />
        </PreferenceRow>
      </div>

      {/* ── Каналы уведомлений ── */}
      <div className="flex flex-col gap-3.5 rounded-2xl bg-panel-raised px-4 py-4 ring-1 ring-edge sm:px-5">
        <p className="text-sm font-semibold text-ink">{t('account.pref.notifications')}</p>

        <PreferenceRow
          inline
          grouped={false}
          label={t('account.pref.channelEmail')}
          hint={user?.email ?? undefined}
        >
          <PreferenceSwitch
            checked={emailOn}
            onChange={(next) => changeChannel(NotificationChannel.Email, next)}
            label={t('account.pref.channelEmail')}
          />
        </PreferenceRow>

        {/* Предупреждение стоит РЯДОМ с тумблером и в момент выключения, а не в общей справке
            раздела: последствие отложенное — человек столкнётся с ним через месяц, когда забудет
            пароль, — и спрятать его в справку значит гарантировать, что он его не прочтёт. */}
        {!emailOn && (
          <div className="alert-in flex items-start gap-2.5 rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning ring-1 ring-warning/40">
            <AlertIcon size={17} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{t('account.pref.emailOffTitle')}</p>
              <p className="mt-0.5 opacity-90">{t('account.pref.emailOffBody')}</p>
            </div>
          </div>
        )}

        <div className="h-px bg-edge" />

        <PreferenceRow
          inline
          grouped={false}
          label={t('account.pref.channelTelegram')}
          /* Объяснение стоит ПЕРЕД тумблером и в разметке, и на экране: отключённая кнопка не
             получает фокус, и `aria-describedby` на ней скринридер бы просто не зачитал. */
          hint={
            telegramLinked
              ? (telegram?.telegramUsername ?? t('account.telegramLinked'))
              : telegram !== null
                ? t('account.pref.telegramNotLinked')
                : t('account.pref.telegramUnknown')
          }
        >
          <PreferenceSwitch
            checked={telegramOn}
            disabled={telegramDisabled}
            onChange={(next) => changeChannel(NotificationChannel.Telegram, next)}
            label={t('account.pref.channelTelegram')}
          />
        </PreferenceRow>

        {/* Тумблер не прячется, а показывается выключенным и объяснённым: спрятанная настройка
            читается как «её нет», и человек уходит искать её в «Безопасности». */}
        {telegramDisabled && (
          <Link to={connectionsHref} className={accountButtonClass('ghost', 'sm', 'self-start')}>
            <TelegramIcon size={16} className="shrink-0" />
            {t('account.pref.telegramConnect')}
          </Link>
        )}

        {lastChannelBlocked && <AuthError message={t('account.pref.lastChannel')} />}
      </div>

      {/* Только ошибка — успех нигде не подтверждается отдельно, см. комментарий у объявления
          компонента. `role="alert"` объявляется скринридеру независимо от места на странице. */}
      {lastSave === 'failed' && <AuthError message={t(preferencesErrorMessageKey(saveError))} />}
    </div>
  )
}

/**
 * Скелетон повторяет геометрию двух карточек раздела — четыре строки «подпись + контрол» и блок
 * уведомлений, — чтобы раздел не «прыгал», когда настройки приходят. Мерцание общее
 * (`.skeleton-shimmer`) и само выключается при `prefers-reduced-motion`.
 */
function PreferencesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      {[4, 2].map((rows) => (
        <div
          key={rows}
          className="flex flex-col gap-4 rounded-2xl bg-panel px-4 py-4 ring-1 ring-edge ring-inset sm:px-5"
        >
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="skeleton-shimmer h-[15px] w-[92px] rounded-lg bg-panel-raised" />
                <div className="skeleton-shimmer mt-2 h-[13px] w-2/3 max-w-[220px] rounded-lg bg-panel-raised" />
              </div>
              <div className="skeleton-shimmer h-9 w-[132px] shrink-0 rounded-full bg-panel-raised" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
