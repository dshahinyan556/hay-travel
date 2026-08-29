/**
 * «Почему это действие недоступно» для экрана «Фоновые задачи» — same shape and reasoning as
 * `orders/lib/orderPermissionHints.ts`, trimmed to the one action this screen's permission matrix
 * actually has: `jobs` carries only `View`/`Update` (`AdminScreens.cs`'s `ViewUpdate` — no
 * `Create`/`Delete`, the job set is fixed by server code). Rubильник, cron, параметры И ручной
 * запуск all gate on the SAME `Update` — the backend does not split them (see
 * `JobsController.cs`'s doc comment on why "Запустить сейчас" has no action of its own).
 */

import type { ScreenPermission } from '@/shared/auth'

export interface JobPermissionHints {
  update: string | null
}

export function jobPermissionHints(permission: ScreenPermission, hint: string): JobPermissionHints {
  return { update: permission.canUpdate ? null : hint }
}
