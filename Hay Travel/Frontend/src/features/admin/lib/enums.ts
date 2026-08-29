/**
 * Enum values shared with the backend.
 *
 * The project's tsconfig has `erasableSyntaxOnly`, which forbids TS `enum`. We model enums
 * as frozen const objects plus a derived value-union type — same call-site ergonomics
 * (`TourType.Tour`), zero runtime enum machinery, fully erasable.
 *
 * VALUES AND TYPES ONLY. Human-readable captions for these enums live in `adminEnumsCopy.ts`
 * (ADR 021): this module is imported by mappers and by the API layer, which must not drag
 * locale-dependent interface text along with a wire constant.
 */

import { EmployeeJobRole } from '@/shared/types/employeeRole'
import { LanguageCode } from '@/shared/types/language'

/* -------------------------------------------------------------------------- */
/*  Tour type                                                                  */
/* -------------------------------------------------------------------------- */

export const TourType = {
  Tour: 1,
  Excursion: 2,
  /** Трансфер (2026-08-29): А → Б, опционально со стопами и обратным рейсом. Живёт в той же
   * таблице, что тур и экскурсия, но из «богатства» тура использует только главную картинку
   * и участие в «Избранном» — ни дней, ни галереи, ни регионов, ни тегов, ни скидки. */
  Transfer: 3,
} as const

export type TourType = (typeof TourType)[keyof typeof TourType]

/* -------------------------------------------------------------------------- */
/*  Tour format                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Формат тура/экскурсии. Значение живёт в `shared/types/tourFormat.ts` и ре-экспортируется
 * отсюда: оно нужно и админке, и публичному сайту, а `shared` не может импортировать `features`.
 * Два независимых объявления одних и тех же чисел рано или поздно разъезжаются, поэтому здесь
 * именно ре-экспорт, а не копия.
 */
export { TourFormat } from '@/shared/types/tourFormat'

/* -------------------------------------------------------------------------- */
/*  Transfer                                                                   */
/* -------------------------------------------------------------------------- */

/** Роль точки в маршруте трансфера — и у предопределённого продукта, и в кастомной заявке. */
export const TransferRoutePointKind = {
  From: 1,
  Stop: 2,
  To: 3,
} as const

export type TransferRoutePointKind =
  (typeof TransferRoutePointKind)[keyof typeof TransferRoutePointKind]

/** Строка заказа — либо бронь продукта из каталога, либо кастомная заявка на трансфер
 * (без продукта и без цены, статус заказа `Request`). */
export const OrderLineKind = {
  Product: 1,
  CustomTransfer: 2,
} as const

export type OrderLineKind = (typeof OrderLineKind)[keyof typeof OrderLineKind]

/* -------------------------------------------------------------------------- */
/*  Tags                                                                       */
/* -------------------------------------------------------------------------- */

/** Purely cosmetic — mirrors backend `TagType`. Скидка тура больше не тег (Фаза 3/7,
 * checklist-orders-redesign.txt) — она живёт прямо на туре, см. `TourFormState.discountPercent`.
 * Single-member on purpose (kept as an object, not inlined, so a future second tag kind doesn't
 * need every call site rewritten). */
export const TagType = {
  Regular: 1,
} as const

export type TagType = (typeof TagType)[keyof typeof TagType]

/** One of the site's own palette tokens (`--color-gold`/`wine`/`success`/`danger`/`warning`) —
 * never a free hex, so a new tag is guaranteed to read in both themes. Mirrors backend
 * `TagColor`. Rendering (Tailwind classes per color) lives in `shared/ui/ProductTag.tsx`, the
 * one place both the admin picker and the public card agree on. */
export const TagColor = {
  Gold: 1,
  Wine: 2,
  Success: 3,
  Danger: 4,
  Warning: 5,
} as const

export type TagColor = (typeof TagColor)[keyof typeof TagColor]

/* -------------------------------------------------------------------------- */
/*  Translation field discriminators                                           */
/* -------------------------------------------------------------------------- */

/** `type` values for a tour's own translatable fields.
 * Note: `Detail` and `Restriction` are no longer translation types — they became separate
 * ordered, multi-value bilingual entities, merged server-side into a single `notes` list
 * discriminated by `TourNoteType` (organizationalDetails / restrictions on the tour form). */
export const TourTranslationType = {
  Title: 1,
  ShortDescription: 2,
  Description: 3,
  Duration: 4,
} as const

export type TourTranslationType = (typeof TourTranslationType)[keyof typeof TourTranslationType]

/** `type` values for a tour day's translatable fields. Route points are no longer a
 * translation type here — they are a separate entity with their own single text field. */
export const TourDayTranslationType = {
  Title: 1,
  ShortDescription: 2,
  Description: 3,
  Duration: 4,
} as const

export type TourDayTranslationType =
  (typeof TourDayTranslationType)[keyof typeof TourDayTranslationType]

/** Additional expenses carry a single description field, encoded as type 0. */
export const ExpenseTranslationType = {
  Description: 0,
} as const

export type ExpenseTranslationType =
  (typeof ExpenseTranslationType)[keyof typeof ExpenseTranslationType]

/* -------------------------------------------------------------------------- */
/*  Region translation                                                        */
/* -------------------------------------------------------------------------- */

/** `type` values for a region's translations. Unlike the other reference catalogs (Place,
 * ExpenseTemplate, TourNoteTemplate — always `type: 0`), Region actually distinguishes two
 * fields: Name (seeded, read-only) and Blurb (editable via `RegionsTab`). */
export const RegionTranslationType = {
  Name: 1,
  Blurb: 2,
} as const

export type RegionTranslationType = (typeof RegionTranslationType)[keyof typeof RegionTranslationType]

/* -------------------------------------------------------------------------- */
/*  Tour note (organizational detail / restriction)                           */
/* -------------------------------------------------------------------------- */

/** Wire-level kind of a tour note. The backend merged `Restriction` and
 * `OrganizationalDetail` into a single `TourNote` entity distinguished by this field — the
 * admin form still shows separate sections, `tourMapper.ts` splits/joins on read/write.
 * `Included`/`NotIncluded` (2026-08) replace the old frontend-only "Включено"/"Не включено"
 * mocks on the public detail page with real, editable notes of these two types. */
export const TourNoteType = {
  OrganizationalDetail: 1,
  Restriction: 2,
  Included: 3,
  NotIncluded: 4,
} as const

export type TourNoteType = (typeof TourNoteType)[keyof typeof TourNoteType]

/* -------------------------------------------------------------------------- */
/*  Site settings                                                              */
/* -------------------------------------------------------------------------- */

/** Section a setting belongs to on the settings screen. Mirrors the backend enum. The catalog
 * that maps keys to groups lives on the server (ADR 002) — the front never enumerates keys,
 * it only labels the groups it recognises and falls back to "Прочее" for the rest. */
export const SiteSettingGroup = {
  Hero: 1,
  Contacts: 2,
  Social: 3,
  Branding: 4,
  Seo: 5,
  /** Public-site text blocks outside Hero (catalog heading, footer tagline, home "featured"
   * section heading) — previously hardcoded in `shared/i18n/dictionary.ts`. */
  Content: 6,
  /** Тема оформления сайта: палитра-пресет + мягкий дефолт dark/light (backend Spec 002). */
  Theme: 7,
} as const

export type SiteSettingGroup = (typeof SiteSettingGroup)[keyof typeof SiteSettingGroup]

/** Which control renders a setting. A rendering hint only — every setting is stored as a
 * string on the server, whatever the type says. */
export const SettingValueType = {
  Text: 1,
  MultilineText: 2,
  Url: 3,
  ImageUrl: 4,
  /** Значение — один id из фиксированного набора `options`. Хранится строкой. */
  Select: 5,
  /** Целое число (часы/дни/лимиты) — добавлен вместе с параметрами фоновых задач (`features/
   * admin/jobs`); экран «Настройки сайта» его пока не рендерит отдельным контролом (сегодня
   * ни один НЕ-джобовский ключ каталога этот тип не использует), но значение уже существует
   * на бэке (`ATTours.Common.Enums.SettingValueType.Number = 6`) и должно быть в этом зеркале. */
  Number: 6,
} as const

export type SettingValueType = (typeof SettingValueType)[keyof typeof SettingValueType]

/* -------------------------------------------------------------------------- */
/*  Employee job role (Задача D)                                              */
/* -------------------------------------------------------------------------- */

/** Re-exported for convenience: every admin call site that needs the enum's VALUES (not just the
 * type) already imports from this module for every other wire enum — see the file doc comment.
 * The type itself is declared in `shared/types/employeeRole.ts` (a cross-cutting leaf both
 * `shared/auth/types.ts` and `shared/types/booking.ts` depend on), not redeclared here. */
export { EmployeeJobRole }

/* -------------------------------------------------------------------------- */
/*  Language                                                                   */
/* -------------------------------------------------------------------------- */

/** Re-exported for the same reason as `EmployeeJobRole` above: admin call sites import every wire
 * enum from this module, and the ~7 existing `LanguageCode` imports keep working unchanged. The
 * declaration itself moved to `shared/types/language.ts` (redesign 2026-08-23) — it is now a
 * cross-cutting leaf both `shared/auth/types.ts` (`UserInfoModel.preferredLanguage`) and
 * `shared/types/booking.ts` (`OrderInfoModel.userPreferredLanguage`) depend on, and `shared`
 * cannot import from `features`. */
export { LanguageCode }
