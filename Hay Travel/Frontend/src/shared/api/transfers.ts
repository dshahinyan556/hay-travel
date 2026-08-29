/**
 * Публичные данные раздела «Трансферы» (батч 2026-08-29).
 *
 * Отдельный модуль, а не ветка в `shared/api/tours.ts`, ровно по той же причине, по которой на
 * бэке отдельный `TransferController`: публичная read-модель у трансфера другая (маршрут и цены
 * по классам авто вместо дней, регионов и тегов). Единственное место во фронтенде, которое знает
 * провод (`TransferCardModel`/`TransferInfoModel`) — дальше по коду ходят только
 * `TransferSummary`/`TransferDetail` из `shared/types/transfer.ts`.
 *
 * Локаль пинится тем же синхронным `getStoredLocale()`, что и в `tours.ts`: loader'ы маршрутов
 * работают вне React, а `useRevalidateOnLocaleChange` перезапускает их при смене языка.
 */

import { apiFetch, ApiError } from '@/shared/lib/http'
import { authFetch } from '@/shared/auth'
import { getStoredLocale, LANGUAGE_CODE_BY_LOCALE } from '@/shared/lib/locale'
import type {
  PlaceInfoModel,
  TransferCardModel,
  TransferInfoModel,
  TransferPriceClientModel,
  TransferRoutePointInfoModel,
  TranslatableInfoModel,
  VehicleClassInfoModel,
} from '@/shared/types/attours'
import type { CustomTransferRequestCreateModel, OrderInfoModel } from '@/shared/types/booking'
import type {
  TransferDetail,
  TransferPoint,
  TransferPointKind,
  TransferSummary,
  TransferVehicleOption,
  VehicleClass,
} from '@/shared/types/transfer'

function currentLanguageCode(): number {
  return LANGUAGE_CODE_BY_LOCALE[getStoredLocale()]
}

/** `TourTranslationType.Title` — из тур-уровневых переводов трансферу нужен только он. */
const TRANSLATION_TITLE = 1
/** Точки маршрута и названия справочников несут одно текстовое поле, всегда `type: 0` — та же
 * конвенция, что в `shared/api/tours.ts` и в админском маппере каталога. */
const TRANSLATION_SINGLE_FIELD = 0

/** `TransferRoutePointKind` на бэке. */
const POINT_KIND: Record<number, TransferPointKind | undefined> = { 1: 'from', 2: 'stop', 3: 'to' }

/** Та же заглушка, что у тура без фото: трансфер без главной картинки валидация не пропускает,
 * но публичная страница обязана пережить старую/битую запись, а не отрисовать сломанный `img`. */
const FALLBACK_IMAGE = '/placeholders/tatev.svg'

function pickTranslation(translations: readonly TranslatableInfoModel[], type: number): string {
  return translations.find((item) => item.type === type)?.value ?? ''
}

/**
 * Маршрут в порядке «откуда → стопы по `sortOrder` → куда».
 *
 * Порядок задаётся ЯВНО по роли точки, а не одним `sortOrder` по всему списку: `sortOrder` у
 * бэка нумерует стопы, и полагаться на то, что «откуда» всегда получило меньшее число, значило
 * бы поставить чтение маршрута в зависимость от того, в каком порядке админ заполнял форму.
 * Точки с пустым текстом выбрасываются — пустая строка в таймлайне читается как баг.
 */
function mapRoute(points: readonly TransferRoutePointInfoModel[]): TransferPoint[] {
  const mapped = points
    .map((point) => ({
      kind: POINT_KIND[point.kind],
      sortOrder: point.sortOrder,
      text: pickTranslation(point.translations, TRANSLATION_SINGLE_FIELD),
    }))
    .filter(
      (point): point is { kind: TransferPointKind; sortOrder: number; text: string } =>
        point.kind !== undefined && point.text !== '',
    )

  const byKind = (kind: TransferPointKind) => mapped.filter((point) => point.kind === kind)

  return [
    ...byKind('from'),
    ...byKind('stop').sort((a, b) => a.sortOrder - b.sortOrder),
    ...byKind('to'),
  ].map(({ kind, text }) => ({ kind, text }))
}

function mapVehicle(price: TransferPriceClientModel): TransferVehicleOption {
  return {
    vehicleClassId: price.vehicleClassId,
    name: price.vehicleClassName,
    capacity: price.capacity,
    luggageCapacity: price.luggageCapacity,
    oneWayPrice: price.oneWayPrice,
    roundTripPrice: price.roundTripPrice,
  }
}

function mapCard(card: TransferCardModel): TransferSummary {
  return {
    id: String(card.id),
    title: pickTranslation(card.translations, TRANSLATION_TITLE),
    coverImage: card.mainImageUrl || FALLBACK_IMAGE,
    route: mapRoute(card.routePoints),
    priceFrom: card.minOneWayPrice,
  }
}

/** Список трансферов для `/transfers`. Значения фильтров «Откуда/Куда» считаются из этого же
 * списка (решение 0.23) — второго запроса и справочника городов нет. */
export async function getTransfers(): Promise<readonly TransferSummary[]> {
  const cards = await apiFetch<TransferCardModel[]>(
    `api/Transfer/GetTransfersClient?languageCode=${currentLanguageCode()}`,
  )
  return cards.map(mapCard)
}

/** `undefined` на 404 (черновик, архив или несуществующий id) — тот же контракт, что у
 * `getTourInfo`, поэтому ветка «не найдено» в loader'е выглядит одинаково. */
export async function getTransferInfo(id: string): Promise<TransferDetail | undefined> {
  try {
    const info = await apiFetch<TransferInfoModel>(
      `api/Transfer/GetTransferInfo?id=${encodeURIComponent(id)}&languageCode=${currentLanguageCode()}`,
    )
    return {
      id: String(info.id),
      title: pickTranslation(info.translations, TRANSLATION_TITLE),
      coverImage: info.mainImageUrl || FALLBACK_IMAGE,
      route: mapRoute(info.routePoints),
      priceFrom:
        info.prices.length === 0 ? null : Math.min(...info.prices.map((price) => price.oneWayPrice)),
      requiresPrepayment: info.requiresPrepayment,
      vehicles: [...info.prices].sort((a, b) => a.sortOrder - b.sortOrder).map(mapVehicle),
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined
    throw err
  }
}

/**
 * Справочник классов авто — нужен КОНСТРУКТОРУ заявки, где продукта (а значит и цен) нет, но
 * «желаемый класс» выбрать можно, и его вместимость/лимит багажа проверяются ещё до отправки.
 *
 * На странице предопределённого трансфера этот запрос НЕ нужен: там классы приезжают
 * развёрнутыми внутри `TransferInfoModel.prices` вместе с ценами.
 */
export async function getVehicleClasses(): Promise<readonly VehicleClass[]> {
  const classes = await apiFetch<VehicleClassInfoModel[]>(
    `api/VehicleClass/GetForClient?languageCode=${currentLanguageCode()}`,
  )
  return classes.map((vehicleClass) => ({
    id: vehicleClass.id,
    name: pickTranslation(vehicleClass.translations, TRANSLATION_SINGLE_FIELD),
    capacity: vehicleClass.capacity,
    luggageCapacity: vehicleClass.luggageCapacity,
  }))
}

/**
 * Подсказки для точек маршрута — названия из каталога `Place` (решение 0.8).
 *
 * Именно ПОДСКАЗКИ: значение точки остаётся свободным текстом, и заявку можно отправить с
 * адресом, которого в каталоге нет. Поэтому сбой запроса здесь — не ошибка экрана, а «подсказок
 * не будет»: конструктор обязан работать и без каталога.
 */
export async function getPlaceSuggestions(): Promise<readonly string[]> {
  const places = await apiFetch<PlaceInfoModel[]>(
    `api/Place/GetForClient?languageCode=${currentLanguageCode()}`,
  )
  return places
    .map((place) => pickTranslation(place.translations, TRANSLATION_SINGLE_FIELD))
    .filter((name) => name !== '')
}

/**
 * Кастомная заявка (решение 0.11). Требует логина: `authFetch` берёт владельца из токена, тело
 * никогда не несёт `userId`.
 *
 * Ошибки здесь не перехватываются намеренно — политика у вызывающего:
 * `features/transfers/lib/transferRequestErrors.ts` превращает коды в текст, а
 * `SessionExpiredError` поднимает блок входа.
 */
export function createTransferRequest(
  model: CustomTransferRequestCreateModel,
): Promise<OrderInfoModel> {
  return authFetch<OrderInfoModel>('api/Order/CreateTransferRequest', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

/**
 * Дни, закрытые для ТРАНСФЕРОВ как типа продукта — правила «весь сайт» + «все трансферы»
 * (решение 0.27). У кастомной заявки продукта нет, поэтому спрашиваем по типу: `tourId` не
 * передаём, `tourType=3`.
 *
 * Для предопределённого трансфера используется обычный `getClosedDates(tourId, …)` из
 * `shared/api/booking.ts`: там тип берётся из БД, а `tourType` из запроса игнорируется.
 */
export function getTransferTypeClosedDates(from: string, to: string): Promise<string[]> {
  return apiFetch<string[]>(`api/Availability/GetClosedDates?tourType=3&from=${from}&to=${to}`)
}
