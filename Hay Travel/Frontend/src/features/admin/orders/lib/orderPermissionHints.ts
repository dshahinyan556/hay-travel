/**
 * «Почему это действие недоступно» — одно значение вместо пары «можно ли» + «что показать».
 *
 * Строка = нельзя, и это её текст для тултипа; `null` = можно. Такая форма выбрана намеренно:
 * компоненты грида/вкладок/попапов не должны ни импортировать `shared/auth`, ни знать про
 * `AccessLevel` — они получают готовый текст и пишут `disabled={pending || hints.update !== null}`.
 * Разъехаться «кнопка выключена, но подсказки нет» (или наоборот) в такой форме нечем.
 *
 * Раскладка действие → право повторяет атрибуты `OrderController` один в один (проверено
 * 2026-08-27), потому что смысл всего этого — не предлагать то, на что сервер ответит 403:
 *   Create → AddLine, AddPayment (и «Добавить» тулбара — черновик нового заказа);
 *   Update → SetStatus (Одобрить/Отклонить/Возобновить), UpdateLine, UpdateLineEmployee,
 *            AssignEmployee, UnassignEmployee, SendToClient;
 *   Delete → RemoveLine, Delete (заказ целиком).
 */

import type { ScreenPermission } from '@/shared/auth'

export interface OrderPermissionHints {
  create: string | null
  update: string | null
  delete: string | null
}

/** Всё разрешено — форма по умолчанию для компонента, которому нечего запрещать. */
export const NO_ORDER_PERMISSION_HINTS: OrderPermissionHints = Object.freeze({
  create: null,
  update: null,
  delete: null,
})

/**
 * `permission` приходит из `useScreenPermission(AdminScreen.Orders)` (подписанный на стор хук, а не
 * разовый `canUpdate(...)` — иначе после фонового обновления матрицы кнопки остались бы с ответом
 * из прошлой сессии), `hint` — локализованный текст (`ordersCopy.noPermissionHint`).
 */
export function orderPermissionHints(permission: ScreenPermission, hint: string): OrderPermissionHints {
  return {
    create: permission.canCreate ? null : hint,
    update: permission.canUpdate ? null : hint,
    delete: permission.canDelete ? null : hint,
  }
}
