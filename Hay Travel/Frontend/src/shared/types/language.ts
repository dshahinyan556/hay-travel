/**
 * Язык, выбранный пользователем для писем — зеркало backend `LanguageCode`
 * (`ATTours.Common/Enums/LanguageCode.cs`). Тот же смысл, что и у языка контента
 * (переводы тура), поэтому один enum на оба применения.
 *
 * Свой zero-import leaf по той же причине, что и `shared/types/employeeRole.ts`:
 * от него зависят и `shared/auth/types.ts` (`UserInfoModel.preferredLanguage`), и
 * `shared/types/booking.ts` (`OrderInfoModel.userPreferredLanguage`), а они не должны
 * импортировать друг друга.
 */
export const LanguageCode = { Russian: 1, English: 2 } as const

export type LanguageCode = (typeof LanguageCode)[keyof typeof LanguageCode]
