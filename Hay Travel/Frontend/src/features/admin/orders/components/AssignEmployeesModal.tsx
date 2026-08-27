import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Input, Modal, Tooltip } from '@/shared/ui'
import type { UserInfoModel } from '@/shared/auth'
import type { EmployeeJobRole } from '@/shared/types/employeeRole'
import type { OrderAssignEmployeeItem } from '@/shared/types/booking'
import { useCopy } from '@/shared/i18n/defineCopy'
import { ordersCopy } from '../lib/ordersCopy'
import { EmployeeJobRoleSelect } from '@/features/admin/ui/EmployeeJobRoleSelect'

/** Показывать фильтр начиная с этого числа сотрудников — для трёх человек поле ввода только шумит. */
const FILTER_THRESHOLD = 8

export interface AssignEmployeesModalProps {
  open: boolean
  /** `null` — назначение на ВСЕ строки заказа; иначе — id конкретной строки. */
  lineId: number | null
  /** Подпись целевой строки («Тур · дата») для шапки. `null` при `lineId === null`. */
  lineLabel: string | null
  employees: UserInfoModel[]
  /** `User.id` тех, кто уже назначен на целевую строку — помечаются меткой «уже назначен»,
   * но НЕ предвыбираются. При `lineId === null` — пустой массив. */
  alreadyAssignedIds: number[]
  pending: boolean
  /** Причина, по которой назначать нельзя (`AssignEmployee` = `Update`), или `null`. Обе кнопки
   * отправки гаснут вместе — тихое назначение и назначение с письмом бьют в один эндпоинт.
   * @default null */
  updateHint?: string | null
  onClose: () => void
  /** Пустой список не приходит — кнопки заблокированы, пока никто не отмечен. */
  onSubmit: (employees: OrderAssignEmployeeItem[], sendEmail: boolean) => void
}

function employeeName(employee: UserInfoModel): string {
  return `${employee.firstName} ${employee.lastName ?? ''}`.trim() || employee.email
}

/**
 * Попап назначения исполнителей (редизайн 2026-08-23) — мультивыбор людей, у каждого своя роль.
 * Один попап обслуживает оба сценария: bulk «на все строки» из меню «…» (`lineId: null`) и
 * «+ Назначить» в конкретной строке грида/пустом состоянии fulfillment-вкладки.
 *
 * Уже назначенные НЕ предвыбираются намеренно: `AssignEmployee` — аддитивный upsert, и предвыбор
 * при нажатии «Назначить и отправить письмо» разослал бы письма заново всем, кто их уже получил.
 * Отметить такого человека можно — так у него меняется роль, и это осознанное действие.
 */
export function AssignEmployeesModal({
  open,
  lineId,
  lineLabel,
  employees,
  alreadyAssignedIds,
  pending,
  updateHint = null,
  onClose,
  onSubmit,
}: AssignEmployeesModalProps) {
  const copy = useCopy(ordersCopy)
  /** Отмеченные сотрудники → выбранная роль. `null` — роль ещё не выбрана (submit заблокирован). */
  const [picked, setPicked] = useState<Map<number, EmployeeJobRole | null>>(new Map())
  const [filter, setFilter] = useState('')

  // Сброс на каждое открытие — иначе прошлый выбор перетёк бы в следующее назначение (после
  // «Отмена» или после успешной отправки, которая закрывает попап).
  useEffect(() => {
    if (open) {
      setPicked(new Map())
      setFilter('')
    }
  }, [open])

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return employees
    return employees.filter(
      (employee) =>
        employeeName(employee).toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query),
    )
  }, [employees, filter])

  function toggle(employee: UserInfoModel, checked: boolean) {
    setPicked((prev) => {
      const next = new Map(prev)
      // Пре-филл роли из профиля сотрудника — удобство, а не жёсткая связь: роль остаётся
      // редактируемой в соседнем селекте.
      if (checked) next.set(employee.id, employee.defaultJobRole ?? null)
      else next.delete(employee.id)
      return next
    })
  }

  function setRole(employeeId: number, role: EmployeeJobRole | null) {
    setPicked((prev) => new Map(prev).set(employeeId, role))
  }

  const canSubmit = picked.size > 0 && [...picked.values()].every((role) => role !== null)

  function submit(sendEmail: boolean) {
    onSubmit(
      [...picked].map(([employeeId, employeeRole]) => ({ employeeId, employeeRole: employeeRole as EmployeeJobRole })),
      sendEmail,
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={copy.assignTitle} size="lg">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">
          {lineId === null ? copy.assignScopeAllLines : copy.assignScopeLine(lineLabel ?? '')}
        </p>

        {employees.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-sm text-neutral-500">
            {copy.noEmployees}
          </p>
        ) : (
          <>
            {employees.length > FILTER_THRESHOLD && (
              <Input
                type="search"
                value={filter}
                disabled={pending}
                placeholder={copy.assignFilterPlaceholder}
                aria-label={copy.assignFilterPlaceholder}
                onChange={(e) => setFilter(e.target.value)}
              />
            )}

            <ul className="max-h-[45vh] divide-y divide-neutral-100 overflow-y-auto">
              {visible.map((employee) => {
                const name = employeeName(employee)
                const isPicked = picked.has(employee.id)
                return (
                  <li
                    key={employee.id}
                    className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0">
                      <Checkbox
                        label={name}
                        checked={isPicked}
                        disabled={pending}
                        aria-label={copy.assignEmployeeAria(name)}
                        onChange={(e) => toggle(employee, e.target.checked)}
                      />
                      {alreadyAssignedIds.includes(employee.id) && (
                        <p className="pl-[26px] text-xs text-neutral-500">{copy.alreadyAssigned}</p>
                      )}
                    </div>
                    {isPicked && (
                      <EmployeeJobRoleSelect
                        value={picked.get(employee.id) ?? null}
                        onChange={(role) => setRole(employee.id, role)}
                        disabled={pending}
                        placeholder={copy.assignRolePlaceholder}
                        className="w-full shrink-0 sm:w-44"
                        aria-label={copy.assignRoleAria(name)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose} className="min-h-11 w-full sm:w-auto">
            {copy.assignCancel}
          </Button>
          <Tooltip
            enabled={updateHint !== null}
            content={updateHint}
            cursor="not-allowed"
            className="w-full sm:w-auto"
          >
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !canSubmit || updateHint !== null}
              onClick={() => submit(false)}
              className="min-h-11 w-full sm:w-auto"
            >
              {pending ? copy.saving : copy.assignSubmitSilent}
            </Button>
          </Tooltip>
          <Tooltip
            enabled={updateHint !== null}
            content={updateHint}
            cursor="not-allowed"
            className="w-full sm:w-auto"
          >
            <Button
              type="button"
              disabled={pending || !canSubmit || updateHint !== null}
              onClick={() => submit(true)}
              className="min-h-11 w-full sm:w-auto"
            >
              {pending ? copy.saving : copy.assignSubmitAndSend}
            </Button>
          </Tooltip>
        </div>
      </div>
    </Modal>
  )
}
