import { useEffect, useRef } from 'react'
import { getTelegramStatus, type TelegramLinkStatusModel } from '../api/telegram'

/**
 * Досматривает привязку Telegram до конца, не заставляя человека жать F5.
 *
 * Рукопожатие заканчивается НЕ здесь: посетитель уходит в мессенджер, там жмёт «Start», и чат
 * привязывает вебхук на сервере. Раньше это означало, что строка «Telegram» на `/account`
 * оживала только на следующем заходе — Давид справедливо назвал это багом: подключил и вернулся,
 * а страница врёт, что не подключено.
 *
 * Два разных сигнала, а не один таймер на всё:
 *  - `visibilitychange` — вернулись во вкладку из мессенджера. Это ТОЧНЫЙ момент, когда статус
 *    почти наверняка изменился, поэтому проверка идёт сразу и работает даже без выданного кода
 *    (привязать могли с телефона, пока вкладка висела открытой).
 *  - опрос раз в 4 с — только пока код выдан И вкладка на экране. Нужен для сценария «Telegram
 *    открыт в соседнем окне на том же мониторе», где `visibilitychange` не сработает вовсе.
 *
 * Пока вкладка скрыта, запросов НЕТ: человек в этот момент в мессенджере, а фоновая долбёжка
 * сервера ничего не ускоряет. Опрос сам умирает через `MAX_POLL_MS` — незакрытая вкладка не
 * должна ходить в API вечно.
 */

/** Пауза между опросами, пока вкладка видима и код выдан. */
const POLL_INTERVAL_MS = 4000

/** Потолок жизни опроса: 5 минут с момента выдачи кода. Дальше сигналом остаётся возврат
 * во вкладку — код к тому времени всё равно, скорее всего, протух. */
const MAX_POLL_MS = 5 * 60 * 1000

interface UseTelegramLinkWatchOptions {
  /** Секция открыта и аккаунт ещё НЕ привязан — иначе смотреть не за чем. */
  enabled: boolean
  /** Код выдан: добавляет периодический опрос к проверке по возврату во вкладку. */
  polling: boolean
  /** Зовётся ровно один раз — в момент, когда сервер впервые ответил `isLinked: true`. */
  onLinked: (status: TelegramLinkStatusModel) => void
  /**
   * Вкладку скрыли, пока код выдан, — человек ушёл в мессенджер. Экран переключается в
   * «ждём ответ от Telegram», чтобы по возвращении он увидел не ту же форму, что оставил.
   */
  onLeft?: () => void
  /**
   * Вернулись во вкладку, проверили — привязки всё ещё нет. Отдельный сигнал, а не молчание:
   * человек ЖДЁТ ответа, и пустой экран он прочитает как «сайт не заметил, что я подключился».
   */
  onStillNotLinked?: () => void
}

export function useTelegramLinkWatch({
  enabled,
  polling,
  onLinked,
  onLeft,
  onStillNotLinked,
}: UseTelegramLinkWatchOptions): void {
  /* Через ref, чтобы смена коллбэка родителем не перезапускала таймер: перезапуск на каждый
     рендер означал бы, что интервал никогда не доживает до срабатывания. */
  const onLinkedRef = useRef(onLinked)
  onLinkedRef.current = onLinked
  const onLeftRef = useRef(onLeft)
  onLeftRef.current = onLeft
  const onStillNotLinkedRef = useRef(onStillNotLinked)
  onStillNotLinkedRef.current = onStillNotLinked

  useEffect(() => {
    if (!enabled) return

    let stopped = false
    let timer: ReturnType<typeof setInterval> | null = null
    const startedAt = Date.now()

    async function check(afterReturn = false) {
      /* Скрытая вкладка не опрашивается: посетитель сейчас в мессенджере. */
      if (stopped || document.visibilityState !== 'visible') return

      try {
        const status = await getTelegramStatus()
        if (stopped) return

        if (!status.isLinked) {
          /* Отвечаем только на ВОЗВРАТ. Фоновый опрос молчит: он тикает раз в 4 секунды, и
             сообщение «пока не видим» на каждый тик было бы мигающим мусором. */
          if (afterReturn) onStillNotLinkedRef.current?.()
          return
        }

        stopped = true
        stopPolling()
        onLinkedRef.current(status)
      } catch {
        /* Молча: это фоновая доводка статуса, а не действие человека. Ошибку показывать
           некому и не за что — следующая попытка придёт сама. */
      }
    }

    function stopPolling() {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    }

    function handleVisibility() {
      if (document.visibilityState !== 'visible') {
        /* Ушли со вкладки, имея на руках код, — почти наверняка в мессенджер. Сообщаем об этом
           экрану, чтобы он встретил человека состоянием ожидания, а не той же формой. */
        if (polling) onLeftRef.current?.()
        return
      }
      void check(true)
    }

    document.addEventListener('visibilitychange', handleVisibility)

    if (polling) {
      timer = setInterval(() => {
        if (Date.now() - startedAt > MAX_POLL_MS) {
          stopPolling()
          return
        }
        void check()
      }, POLL_INTERVAL_MS)
    }

    return () => {
      stopped = true
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, polling])
}
