import { useState } from 'react'
import { Button, Modal, Select } from '@/shared/ui'
import type { UserInfoModel } from '@/shared/auth'
import { ordersCopy } from '../lib/ordersCopy'

export interface AssignAllModalProps {
  open: boolean
  employees: UserInfoModel[]
  pending: boolean
  onClose: () => void
  /** `sendEmail: false` → the popup's silent "Назначить"; `true` → "Назначить и отправить письмо"
   * (checklist §5 — the contextual "Назначить исполнителя" action, 3 buttons: Отмена/Назначить/
   * Назначить и отправить письмо). Both assign every line (`lineId: null`, the backend's "every
   * line" convention) — this task keeps one-employee-per-line/per-order, no per-line role picker. */
  onSubmit: (employeeId: number, sendEmail: boolean) => void
}

/** "Назначить исполнителя" (checklist §5, supersedes the old bulk-only "Назначить на все строки"
 * ActionsMenu item) — a small `Modal` for the ONE input this needs: which employee, plus a choice
 * of whether to notify them right away. Both submit buttons call `assignEmployee` with `lineId:
 * null`; only `sendEmail` differs. */
export function AssignAllModal({ open, employees, pending, onClose, onSubmit }: AssignAllModalProps) {
  const [employeeId, setEmployeeId] = useState('')

  return (
    <Modal open={open} onClose={onClose} title={ordersCopy.assignAllTitle}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">{ordersCopy.assignAllBody}</p>

        {employees.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-sm text-neutral-500">
            {ordersCopy.noEmployees}
          </p>
        ) : (
          <label className="text-xs text-neutral-500">
            {ordersCopy.assignFieldLabel}
            <Select
              surface="admin"
              value={employeeId}
              onChange={setEmployeeId}
              placeholder={ordersCopy.assignPlaceholder}
              options={employees.map((employee) => ({
                value: String(employee.id),
                label: `${employee.firstName} ${employee.lastName ?? ''}`.trim() || employee.email,
              }))}
              className="mt-1"
            />
          </label>
        )}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose} className="min-h-11 w-full sm:w-auto">
            {ordersCopy.assignCancel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || employeeId === ''}
            onClick={() => onSubmit(Number(employeeId), false)}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? ordersCopy.saving : ordersCopy.assignSubmitSilent}
          </Button>
          <Button
            type="button"
            disabled={pending || employeeId === ''}
            onClick={() => onSubmit(Number(employeeId), true)}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? ordersCopy.saving : ordersCopy.assignSubmitAndSend}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
