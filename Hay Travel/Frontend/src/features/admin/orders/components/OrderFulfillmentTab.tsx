import { useState } from 'react'
import { Button, Input, Textarea, Tooltip } from '@/shared/ui'
import { ChevronDownIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { UserInfoModel } from '@/shared/auth'
import { LanguageCode } from '@/shared/types/language'
import type {
  OrderInfoModel,
  OrderLineEmployeeInfoModel,
  OrderLineInfoModel,
} from '@/shared/types/booking'
import { employeeRoleLabel, ordersCopy } from '../lib/ordersCopy'

/** Значения — всегда `string`, хотя в `OrderLineEmployeeInfoModel` эти четыре поля nullable:
 * контролируемый инпут не умеет выдать `null`, а «пусто → `null`» — правило сериализации при
 * сохранении (`saveDraft` страницы), а не состояние черновика. Ключи всё равно завязаны на модель,
 * поэтому переименование поля на бэке сломает компиляцию здесь, а не тихо разъедется. */
export type LineEmployeeFieldPatch = Partial<
  Record<keyof Pick<OrderLineEmployeeInfoModel, 'pickupDetails' | 'navigatorLink' | 'comment' | 'commentEn'>, string>
>

export interface OrderFulfillmentTabProps {
  /** Уже с наложенным черновиком — правки в полях ниже могут быть несохранёнными; коммитит их
   * общий Save страницы, не эта вкладка. */
  order: OrderInfoModel
  /** Справочник сотрудников — нужен ТОЛЬКО чтобы узнать `preferredLanguage` назначенного
   * человека и решить, раскрывать ли EN-блок. Пустой массив допустим (нет права `users.View`):
   * тогда авто-раскрытие просто не срабатывает. */
  employees: UserInfoModel[]
  pending: boolean
  /** Причина недоступности правок/назначения (`UpdateLineEmployee` и `AssignEmployee` — оба
   * `Update`), или `null`. Поля карточек страница гасит через `pending`; здесь значение нужно,
   * чтобы КНОПКИ объясняли причину, а не просто гасли.
   * @default null */
  updateHint?: string | null
  onChangeEmployeeField: (employee: OrderLineEmployeeInfoModel, patch: LineEmployeeFieldPatch) => void
  /** «Назначить и отправить» по СТРОКЕ: переотправляет письмо всем её исполнителям. */
  onAssignAndSend: (line: OrderLineInfoModel) => void
  /** Открыть попап назначения из пустого состояния строки. */
  onRequestAssign: (lineId: number) => void
}

/**
 * Карточка ОДНОГО исполнителя строки — «детали для выполнения» теперь у каждого свои, а не одни на
 * строку. Ни одно поле здесь не сохраняется само: всё уходит в черновик страницы, коммитит общий
 * Save.
 *
 * EN-комментарий спрятан за локальным toggle (`Accordion` из `shared/ui` не берём — он про
 * публичный FAQ). Раскрыт изначально, если перевод уже есть ИЛИ язык писем этого сотрудника —
 * английский: иначе у заказа из трёх строк с двумя исполнителями получается стена из 24 контролов.
 */
function EmployeeFulfillmentCard({
  employee,
  pending,
  defaultExpandEn,
  onChange,
}: {
  employee: OrderLineEmployeeInfoModel
  pending: boolean
  /** `preferredLanguage === English` у этого сотрудника. */
  defaultExpandEn: boolean
  onChange: (patch: LineEmployeeFieldPatch) => void
}) {
  const copy = useCopy(ordersCopy)
  const roleLabels = useCopy(adminEnumsCopy).employeeJobRole
  const [expanded, setExpanded] = useState(() => defaultExpandEn || Boolean(employee.commentEn?.trim()))

  const name = employee.employeeFullName?.trim() || copy.dash

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-neutral-900">{name}</p>
        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
          {employeeRoleLabel(roleLabels, employee.employeeRole)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <label className="text-xs text-neutral-500">
          {copy.fulfillmentPickupLabel}
          <Textarea
            value={employee.pickupDetails ?? ''}
            disabled={pending}
            placeholder={copy.fulfillmentPickupPlaceholder}
            onChange={(e) => onChange({ pickupDetails: e.target.value })}
            className="mt-1"
            rows={2}
          />
        </label>
        <label className="text-xs text-neutral-500">
          {copy.fulfillmentNavigatorLabel}
          <Input
            value={employee.navigatorLink ?? ''}
            disabled={pending}
            placeholder={copy.fulfillmentNavigatorPlaceholder}
            onChange={(e) => onChange({ navigatorLink: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-xs text-neutral-500">
          {copy.fulfillmentCommentLabel}
          <Textarea
            value={employee.comment ?? ''}
            disabled={pending}
            placeholder={copy.fulfillmentCommentPlaceholder}
            onChange={(e) => onChange({ comment: e.target.value })}
            className="mt-1"
            rows={2}
          />
        </label>

        <div>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-neutral-700 transition-colors hover:text-neutral-900 focus:outline-none focus-visible:underline"
          >
            <ChevronDownIcon
              size={14}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            {copy.fulfillmentCommentEnToggle}
          </button>
          {expanded ? (
            <label className="mt-1 block text-xs text-neutral-500">
              <span className="sr-only">{copy.fulfillmentCommentEnLabel}</span>
              <Textarea
                value={employee.commentEn ?? ''}
                disabled={pending}
                placeholder={copy.fulfillmentCommentPlaceholder}
                aria-label={copy.fulfillmentCommentEnLabel}
                onChange={(e) => onChange({ commentEn: e.target.value })}
                rows={2}
              />
            </label>
          ) : (
            !employee.commentEn?.trim() && (
              <p className="text-xs text-neutral-500">{copy.fulfillmentCommentEnFallbackHint}</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}

/** Одна строка заказа: шапка + карточка на каждого её исполнителя + переотправка письма всем им. */
function LineFulfillmentCard({
  line,
  employees,
  pending,
  updateHint,
  onChangeEmployeeField,
  onAssignAndSend,
  onRequestAssign,
}: {
  line: OrderLineInfoModel
  employees: UserInfoModel[]
  pending: boolean
  updateHint: string | null
  onChangeEmployeeField: (employee: OrderLineEmployeeInfoModel, patch: LineEmployeeFieldPatch) => void
  onAssignAndSend: () => void
  onRequestAssign: () => void
}) {
  const copy = useCopy(ordersCopy)
  const isEmpty = line.employees.length === 0
  const blocked = updateHint !== null

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-neutral-900">{line.tourTitle ?? copy.tourFallback(line.tourId)}</p>
          <p className="text-xs text-neutral-500">{line.tourDate}</p>
        </div>
        <p className="text-xs text-neutral-500">{copy.fulfillmentEmployeesCount(line.employees.length)}</p>
      </div>

      {isEmpty ? (
        <div className="mt-3 flex flex-col items-start gap-2 rounded-lg border border-dashed border-neutral-200 px-3 py-3">
          <p className="text-sm text-neutral-500">{copy.fulfillmentLineEmpty}</p>
          <Tooltip enabled={blocked} content={updateHint} cursor="not-allowed">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending || blocked}
              onClick={onRequestAssign}
              className="min-h-11"
            >
              {copy.actionAssign}
            </Button>
          </Tooltip>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {line.employees.map((employee) => (
            <EmployeeFulfillmentCard
              key={employee.id}
              employee={employee}
              pending={pending}
              defaultExpandEn={
                employees.find((candidate) => candidate.id === employee.employeeId)?.preferredLanguage ===
                LanguageCode.English
              }
              onChange={(patch) => onChangeEmployeeField(employee, patch)}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {/* Две причины могут совпасть (нет исполнителей И нет прав) — тултип показывает именно
              «нет прав»: пустую строку пользователь может исправить, отсутствие права — нет. */}
          <Tooltip enabled={blocked} content={updateHint} cursor="not-allowed">
            <Button
              type="button"
              size="sm"
              disabled={pending || isEmpty || blocked}
              title={isEmpty && !blocked ? copy.fulfillmentAssignAndSendHint : undefined}
              onClick={onAssignAndSend}
              className="min-h-11"
            >
              {copy.fulfillmentAssignAndSend}
            </Button>
          </Tooltip>
        </div>
        {isEmpty && <p className="text-xs text-neutral-500">{copy.fulfillmentAssignAndSendHint}</p>}
      </div>
    </div>
  )
}

/**
 * Вкладка «Детали для выполнения». Переписана под мульти-исполнителей (редизайн 2026-08-23): один
 * блок на строку заказа, внутри — карточка на КАЖДОГО её исполнителя со своими pickup/навигатором/
 * комментарием (RU+EN). Раньше эти поля жили на самой строке, и второй исполнитель их бы затирал.
 *
 * Поля — черновиковые (общий Save/Cancel страницы), «Назначить и отправить» — немедленное действие
 * с побочным эффектом, как и всё остальное «отправляющее» на этом экране.
 */
export function OrderFulfillmentTab({
  order,
  employees,
  pending,
  updateHint = null,
  onChangeEmployeeField,
  onAssignAndSend,
  onRequestAssign,
}: OrderFulfillmentTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {order.lines.map((line) => (
        <LineFulfillmentCard
          key={line.id}
          line={line}
          employees={employees}
          pending={pending}
          updateHint={updateHint}
          onChangeEmployeeField={onChangeEmployeeField}
          onAssignAndSend={() => onAssignAndSend(line)}
          onRequestAssign={() => onRequestAssign(line.id)}
        />
      ))}
    </div>
  )
}
