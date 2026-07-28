/**
 * The 11 regions (provinces) of Armenia — metadata only: names, label positions, blurbs.
 *
 * SVG path geometry lives in `regionGeometry.ts`, deliberately split out: it is ~40KB and only
 * the map draws it, while tour cards and catalog filters import this module just for the
 * Russian names. Keeping them together would ship the whole outline of Armenia to every page
 * that renders a card.
 *
 * Geometry source (see the other file): geoBoundaries ADM1, open licence — real borders, not a
 * stylised outline, and not the paid stock vector (copyright).
 *
 * `labelAt` is the visual centre of the largest ring — where the name is drawn. It is NOT the
 * geometric centroid, which on a concave shape can land outside the province.
 *
 * Generated file.
 */

export const MAP_VIEWBOX = { width: 1000, height: 1009 } as const

export type RegionSlug =
  | 'yerevan'
  | 'aragatsotn'
  | 'ararat'
  | 'armavir'
  | 'gegharkunik'
  | 'kotayk'
  | 'lori'
  | 'shirak'
  | 'syunik'
  | 'vayots-dzor'
  | 'tavush'

export interface Region {
  slug: RegionSlug
  /** Russian name — the primary UI language. */
  ru: string
  en: string
  /** Where to draw the label, in `MAP_VIEWBOX` coordinates. */
  labelAt: readonly [number, number]
  /**
   * Tiny enclave, Yerevan only. It is filled from its own path like every other region; the flag
   * adds a city dot marker on top and, on touch devices, an enlarged invisible hit area — see
   * `ArmeniaMap`.
   */
  isEnclave?: boolean
  /** One-line teaser of what the region is known for. */
  blurb: string
}

export const REGIONS: readonly Region[] = [
  {
    slug: 'yerevan',
    ru: 'Ереван',
    en: 'Yerevan',
    labelAt: [339, 473],
    isEnclave: true,
    blurb: 'Каскад, Вернисаж, площадь Республики',
  },
  {
    slug: 'aragatsotn',
    ru: 'Арагацотн',
    en: 'Aragatsotn',
    labelAt: [209, 359],
    blurb: 'Амберд, Сагмосаванк, склоны Арагаца',
  },
  {
    slug: 'ararat',
    ru: 'Арарат',
    en: 'Ararat',
    labelAt: [405, 541],
    blurb: 'Хор Вирап на фоне Арарата',
  },
  {
    slug: 'armavir',
    ru: 'Армавир',
    en: 'Armavir',
    labelAt: [193, 468],
    blurb: 'Эчмиадзин, Звартноц, виноградники',
  },
  {
    slug: 'gegharkunik',
    ru: 'Гегаркуник',
    en: 'Gegharkunik',
    labelAt: [567, 411],
    blurb: 'Севан, Севанаванк, горные пляжи',
  },
  {
    slug: 'kotayk',
    ru: 'Котайк',
    en: 'Kotayk',
    labelAt: [376, 371],
    blurb: 'Гарни, Гегард, Цахкадзор',
  },
  {
    slug: 'lori',
    ru: 'Лори',
    en: 'Lori',
    labelAt: [313, 139],
    blurb: 'Санаин, Ахпат, ущелье Дебед',
  },
  {
    slug: 'shirak',
    ru: 'Ширак',
    en: 'Shirak',
    labelAt: [137, 216],
    blurb: 'Гюмри, Мармашен, чёрный туф',
  },
  {
    slug: 'syunik',
    ru: 'Сюник',
    en: 'Syunik',
    labelAt: [852, 786],
    blurb: 'Татев, Крылья Татева, Хндзореск',
  },
  {
    slug: 'vayots-dzor',
    ru: 'Вайоц-Дзор',
    en: 'Vayots Dzor',
    labelAt: [623, 622],
    blurb: 'Нораванк, Арени, пещера птиц',
  },
  {
    slug: 'tavush',
    ru: 'Тавуш',
    en: 'Tavush',
    labelAt: [503, 144],
    blurb: 'Дилижан, Агарцин, Гошаванк',
  },
]

export const REGION_BY_SLUG = Object.fromEntries(REGIONS.map((r) => [r.slug, r])) as Record<
  RegionSlug,
  Region
>
