/**
 * Employee job-role snapshot (Задача D) — mirrors backend `EmployeeJobRole`
 * (`ATTours.Common/Enums/EmployeeJobRole.cs`). Separate from the account-tier `RoleType`
 * (`shared/auth/types.ts`): `RoleType` is API access, this is what the person DOES on a booking.
 *
 * Its own leaf module (imports nothing) so both `shared/auth/types.ts` (`User.defaultJobRole`) and
 * `shared/types/booking.ts` (`OrderLine.employeeRole`) can depend on it without importing each
 * other — same "leaf module" reasoning `shared/auth/types.ts`'s own doc comment gives for itself.
 */
export const EmployeeJobRole = {
  Driver: 1,
  Guide: 2,
  DriverGuide: 3,
} as const

export type EmployeeJobRole = (typeof EmployeeJobRole)[keyof typeof EmployeeJobRole]
