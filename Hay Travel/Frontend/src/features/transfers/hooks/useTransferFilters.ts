import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { transferPointOf, type TransferSummary } from '@/shared/types/transfer'

/**
 * Фильтры «Откуда / Куда» на `/transfers`, живущие в АДРЕСЕ страницы (решения 0.23/0.25).
 *
 * URL — источник правды по той же причине, что и в каталоге туров (`useTourFilters`): ссылку
 * «Ереван → Гюмри» можно отправить, она переживает перезагрузку и работает с кнопкой «Назад».
 * Значения по умолчанию из адреса вычищаются, поэтому чистая страница остаётся `/transfers`.
 *
 * Здесь проще, чем в каталоге: два дискретных значения и никакого потока (слайдера цены нет),
 * поэтому отложенного коммита (`useDeferredCommit`) не нужно — выбор из списка мгновенный.
 *
 * ЗНАЧЕНИЯ фильтров — не справочник городов, а сами точки уже заведённых трансферов
 * (решение 0.23): справочник заводить не стали, а список из данных всегда актуален и всегда
 * короткий. Сравнение — по ТОЧНОМУ тексту точки, как её ввёл админ: «Ереван» и «Ереван, центр»
 * будут разными пунктами. Это не баг, а прямое следствие решения 0.8 (точки — свободный текст);
 * лечится в админке, а не здесь.
 */

export interface TransferFilters {
  /** Точный текст точки «откуда»; `''` — фильтр не выбран. */
  from: string
  to: string
}

export interface UseTransferFilters {
  filters: TransferFilters
  setFilter: (key: keyof TransferFilters, value: string) => void
  reset: () => void
  isFiltered: boolean
}

export function useTransferFilters(): UseTransferFilters {
  const [params, setParams] = useSearchParams()

  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  const setFilter = useCallback(
    (key: keyof TransferFilters, value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value === '') next.delete(key)
          else next.set(key, value)
          return next
        },
        // `preventScrollReset`: ряд фильтров стоит над сеткой, и прыжок к началу страницы после
        // каждого выбора выбрасывал бы посетителя из того места, где он работает.
        { preventScrollReset: true },
      )
    },
    [setParams],
  )

  const reset = useCallback(() => {
    setParams(new URLSearchParams(), { preventScrollReset: true })
  }, [setParams])

  return {
    filters: { from, to },
    setFilter,
    reset,
    isFiltered: from !== '' || to !== '',
  }
}

/** Одно значение фильтра + сколько трансферов за ним стоит. Счётчик показывается рядом с
 * пунктом списка: на коротком списке это дешевле любого «умного» скрытия — видно сразу, что за
 * «Дилижаном» всего один маршрут, и клик не тратится впустую. */
export interface TransferFilterOption {
  value: string
  count: number
}

/**
 * Уникальные «откуда» и «куда» из УЖЕ ЗАГРУЖЕННОГО списка — второго запроса нет и справочника
 * тоже (решение 0.23).
 *
 * Счётчики считаются по НЕОТФИЛЬТРОВАННОМУ списку намеренно: если бы «Куда» пересчитывалось под
 * выбранное «Откуда», список то и дело менял бы длину под пальцем, а пункты исчезали бы и
 * появлялись. Оба фильтра независимы — так же, как `kind` и `region` в каталоге туров.
 */
export function useTransferFilterOptions(transfers: readonly TransferSummary[]): {
  from: readonly TransferFilterOption[]
  to: readonly TransferFilterOption[]
} {
  return useMemo(() => {
    const collect = (kind: 'from' | 'to'): TransferFilterOption[] => {
      const counts = new Map<string, number>()
      for (const transfer of transfers) {
        const point = transferPointOf(transfer.route, kind)
        if (point === '') continue
        counts.set(point, (counts.get(point) ?? 0) + 1)
      }
      return [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value))
    }
    return { from: collect('from'), to: collect('to') }
  }, [transfers])
}

export function applyTransferFilters(
  transfers: readonly TransferSummary[],
  filters: TransferFilters,
): readonly TransferSummary[] {
  if (filters.from === '' && filters.to === '') return transfers
  return transfers.filter((transfer) => {
    if (filters.from !== '' && transferPointOf(transfer.route, 'from') !== filters.from) return false
    if (filters.to !== '' && transferPointOf(transfer.route, 'to') !== filters.to) return false
    return true
  })
}
