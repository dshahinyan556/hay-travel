/**
 * Enum values shared with the backend.
 *
 * The project's tsconfig has `erasableSyntaxOnly`, which forbids TS `enum`. We model enums
 * as frozen const objects plus a derived value-union type — same call-site ergonomics
 * (`TourType.Tour`), zero runtime enum machinery, fully erasable.
 */

/* -------------------------------------------------------------------------- */
/*  Tour type                                                                  */
/* -------------------------------------------------------------------------- */

export const TourType = {
  Tour: 1,
  Excursion: 2,
} as const

export type TourType = (typeof TourType)[keyof typeof TourType]

export const tourTypeLabels: Record<TourType, string> = {
  [TourType.Tour]: 'Тур',
  [TourType.Excursion]: 'Экскурсия',
}

/* -------------------------------------------------------------------------- */
/*  Language                                                                   */
/* -------------------------------------------------------------------------- */

export const LanguageCode = {
  Russian: 1,
  English: 2,
} as const

export type LanguageCode = (typeof LanguageCode)[keyof typeof LanguageCode]

/* -------------------------------------------------------------------------- */
/*  Translation field discriminators                                           */
/* -------------------------------------------------------------------------- */

/** `type` values for a tour's own translatable fields.
 * Note: `Detail` and `Restriction` are no longer translation types — they became separate
 * ordered, multi-value bilingual entities (organizationalDetails / restrictions on the tour). */
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
