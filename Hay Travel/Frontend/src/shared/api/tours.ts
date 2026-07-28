/**
 * Mock data source for the public site.
 *
 * This is the ONLY module that knows where tour data comes from. Route loaders call these
 * functions; when the real API lands (`GetToursClient` / `GetTourInfo`, see `docs/backend-api.md`),
 * only this file changes — types, loaders and components stay as they are.
 *
 * Regions are mocked here too: the `Region` entity and the many-to-many `Tour↔Region` link
 * do not exist on the backend yet (planned as a separate step), so `regionSlugs` is authored
 * by hand for now.
 *
 * Images are generated local placeholders (see `photo` below) until the client supplies real
 * photography.
 */

import type { RegionSlug } from '@/shared/data/armeniaRegions'
import type { Tour } from '@/shared/types/tour'

/** Simulates network latency so loading states are actually visible during development. */
const LATENCY_MS = 260

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

/**
 * Local placeholder scenes (layered mountains in the site palette), served from `public/`.
 *
 * Deliberately NOT remote stock URLs: the ones tried first returned 404s and rendered as broken
 * images. A generated placeholder always loads, needs no network, and looks intentional until
 * the client supplies real photography — at which point only these paths change.
 */
const photo = (scene: string) => `/placeholders/${scene}.svg`

const TOURS: readonly Tour[] = [
  {
    id: '1',
    slug: 'yug-armenii-tatev',
    title: 'Юг Армении: Татев и Крылья',
    kind: 'tour',
    regionSlugs: ['syunik', 'vayots-dzor'],
    durationDays: 3,
    durationNights: 2,
    priceFrom: 290,
    currency: 'USD',
    coverImage: photo('tatev'),
    gallery: [photo('tatev'), photo('gyumri')],
    shortDescription:
      'Три дня по югу: монастырь Татев, самая длинная в мире пассажирская канатная дорога и пещерный Хндзореск.',
    rating: 4.9,
    reviewCount: 128,
    badges: [
      { type: 'popular', label: 'Популярное' },
      { type: 'lastSeats', label: 'Последние места' },
    ],
    itinerary: [
      {
        day: 1,
        title: 'Ереван — Нораванк — Горис',
        description: 'Выезд утром, остановка в ущелье Нораванка, ночёвка в Горисе.',
        routePoints: ['Ереван', 'Арени', 'Нораванк', 'Горис'],
      },
      {
        day: 2,
        title: 'Татев и Крылья Татева',
        description: 'Канатная дорога над Воротанским ущельем, монастырь Татев, Хндзореск.',
        routePoints: ['Крылья Татева', 'Монастырь Татев', 'Хндзореск'],
      },
      {
        day: 3,
        title: 'Возвращение через Севан',
        description: 'Дорога назад с остановкой у озера и обедом с рыбой.',
        routePoints: ['Горис', 'Селимский перевал', 'Ереван'],
      },
    ],
    included: ['Транспорт', 'Гид', '2 ночи в отеле', 'Завтраки', 'Канатная дорога'],
    excluded: ['Обеды и ужины', 'Личные расходы', 'Страховка'],
  },
  {
    id: '2',
    slug: 'garni-gegard',
    title: 'Гарни и Гегард',
    kind: 'excursion',
    regionSlugs: ['kotayk'],
    durationDays: 1,
    durationNights: 0,
    priceFrom: 45,
    currency: 'USD',
    coverImage: photo('garni'),
    gallery: [photo('garni')],
    shortDescription:
      'Языческий храм Гарни, симфония камней в ущелье и высеченный в скале монастырь Гегард — за один день.',
    rating: 4.8,
    reviewCount: 214,
    badges: [{ type: 'guide', label: 'С гидом' }],
    itinerary: [
      {
        day: 1,
        title: 'Гарни, симфония камней, Гегард',
        description: 'Выезд из Еревана, храм Гарни, базальтовые органы и монастырь Гегард.',
        routePoints: ['Ереван', 'Храм Гарни', 'Симфония камней', 'Монастырь Гегард'],
      },
    ],
    included: ['Транспорт', 'Гид', 'Входные билеты'],
    excluded: ['Обед', 'Личные расходы'],
  },
  {
    id: '3',
    slug: 'sevan-dilijan',
    title: 'Севан и Дилижан',
    kind: 'tour',
    regionSlugs: ['gegharkunik', 'tavush'],
    durationDays: 2,
    durationNights: 1,
    priceFrom: 170,
    currency: 'USD',
    coverImage: photo('sevan'),
    gallery: [photo('sevan')],
    shortDescription:
      'Озеро Севан, монастырь Севанаванк и «армянская Швейцария» — лесной Дилижан с ночёвкой.',
    rating: 4.7,
    reviewCount: 96,
    badges: [
      { type: 'discount', label: '−15%' },
      { type: 'popular', label: 'Популярное' },
    ],
    itinerary: [
      {
        day: 1,
        title: 'Севан и Севанаванк',
        description: 'Озеро, монастырь на полуострове, ночёвка в Дилижане.',
        routePoints: ['Ереван', 'Севанаванк', 'Дилижан'],
      },
      {
        day: 2,
        title: 'Агарцин и Гошаванк',
        description: 'Лесные монастыри Тавуша и старый центр Дилижана.',
        routePoints: ['Агарцин', 'Гошаванк', 'Ереван'],
      },
    ],
    included: ['Транспорт', 'Гид', '1 ночь в отеле', 'Завтрак'],
    excluded: ['Обеды', 'Личные расходы'],
  },
  {
    id: '4',
    slug: 'khor-virap-echmiadzin',
    title: 'Хор Вирап и Эчмиадзин',
    kind: 'excursion',
    regionSlugs: ['ararat', 'armavir'],
    durationDays: 1,
    durationNights: 0,
    priceFrom: 50,
    currency: 'USD',
    coverImage: photo('ararat'),
    gallery: [photo('ararat')],
    shortDescription:
      'Монастырь на фоне Арарата, главный собор Армянской церкви и руины Звартноца.',
    rating: 4.6,
    reviewCount: 73,
    badges: [{ type: 'guide', label: 'С гидом' }],
    itinerary: [
      {
        day: 1,
        title: 'Хор Вирап, Эчмиадзин, Звартноц',
        description: 'Вид на Арарат, духовный центр страны и античный храм.',
        routePoints: ['Хор Вирап', 'Эчмиадзин', 'Звартноц'],
      },
    ],
    included: ['Транспорт', 'Гид', 'Входные билеты'],
    excluded: ['Обед', 'Личные расходы'],
  },
  {
    id: '5',
    slug: 'gyumri-lori',
    title: 'Гюмри и монастыри Лори',
    kind: 'tour',
    regionSlugs: ['shirak', 'lori'],
    durationDays: 2,
    durationNights: 1,
    priceFrom: 185,
    currency: 'USD',
    coverImage: photo('gyumri'),
    gallery: [photo('gyumri')],
    shortDescription:
      'Чёрный туф Гюмри, монастыри Санаин и Ахпат из списка ЮНЕСКО, ущелье Дебед.',
    rating: 4.7,
    reviewCount: 54,
    badges: [{ type: 'popular', label: 'Популярное' }],
    itinerary: [
      {
        day: 1,
        title: 'Гюмри',
        description: 'Старый центр, чёрный туф, городские кофейни. Ночёвка.',
        routePoints: ['Ереван', 'Гюмри', 'Мармашен'],
      },
      {
        day: 2,
        title: 'Санаин и Ахпат',
        description: 'Два монастыря ЮНЕСКО и ущелье Дебед.',
        routePoints: ['Санаин', 'Ахпат', 'Ереван'],
      },
    ],
    included: ['Транспорт', 'Гид', '1 ночь в отеле', 'Завтрак'],
    excluded: ['Обеды', 'Личные расходы'],
  },
  {
    id: '6',
    slug: 'yerevan-city',
    title: 'Ереван за один день',
    kind: 'excursion',
    regionSlugs: ['yerevan'],
    durationDays: 1,
    durationNights: 0,
    priceFrom: 35,
    currency: 'USD',
    coverImage: photo('yerevan'),
    gallery: [photo('yerevan')],
    shortDescription:
      'Каскад, площадь Республики, Вернисаж и коньячный дом — розовый город целиком.',
    rating: 4.8,
    reviewCount: 187,
    badges: [{ type: 'popular', label: 'Популярное' }],
    itinerary: [
      {
        day: 1,
        title: 'Центр Еревана',
        description: 'Пешая прогулка по центру с дегустацией коньяка.',
        routePoints: ['Площадь Республики', 'Каскад', 'Вернисаж', 'Арарат Брэнди'],
      },
    ],
    included: ['Гид', 'Дегустация'],
    excluded: ['Обед', 'Транспорт по городу'],
  },
  {
    id: '7',
    slug: 'amberd-aragats',
    title: 'Амберд и склоны Арагаца',
    kind: 'excursion',
    regionSlugs: ['aragatsotn'],
    durationDays: 1,
    durationNights: 0,
    priceFrom: 55,
    currency: 'USD',
    coverImage: photo('aragats'),
    gallery: [photo('aragats')],
    shortDescription: 'Крепость Амберд на высоте 2300 м, озеро Кари и монастырь Сагмосаванк.',
    rating: 4.5,
    reviewCount: 41,
    badges: [{ type: 'lastSeats', label: 'Последние места' }],
    itinerary: [
      {
        day: 1,
        title: 'Амберд, озеро Кари, Сагмосаванк',
        description: 'Высокогорный день на склонах Арагаца.',
        routePoints: ['Сагмосаванк', 'Амберд', 'Озеро Кари'],
      },
    ],
    included: ['Транспорт', 'Гид'],
    excluded: ['Обед', 'Тёплая одежда'],
  },
]

export function getTours(): Promise<readonly Tour[]> {
  return delay(TOURS)
}

/** Newest/most prominent products for the home page showcase. */
export function getFeaturedTours(limit = 3): Promise<readonly Tour[]> {
  return delay(TOURS.filter((t) => t.badges.length > 0).slice(0, limit))
}

export function getTourBySlug(slug: string): Promise<Tour | undefined> {
  return delay(TOURS.find((t) => t.slug === slug))
}

export function getToursByRegion(region: RegionSlug): Promise<readonly Tour[]> {
  return delay(TOURS.filter((t) => t.regionSlugs.includes(region)))
}

/**
 * How many products each region has — drives the map tooltip counters and dims regions
 * with nothing to sell. Computed synchronously: the map needs it to paint its initial state,
 * and it is derived from data the page already has.
 *
 * Note Vayots Dzor deliberately has only a pass-through tour, and some regions have none —
 * the empty region panel is a real state that has to look intentional.
 */
export function countToursByRegion(tours: readonly Tour[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tour of tours) {
    for (const region of tour.regionSlugs) {
      counts[region] = (counts[region] ?? 0) + 1
    }
  }
  return counts
}
