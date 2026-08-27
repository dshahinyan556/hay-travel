import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { AdminActionButton, Checkbox, Input, Select } from '@/shared/ui'
import type { SelectOption } from '@/shared/ui'
// `HelpButton` не выведен в барель `shared/ui` — импортируется напрямую, как в `TranslationGroup`.
import { HelpButton } from '@/shared/ui/HelpButton'
import { CloseIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { UserInfoModel } from '@/shared/auth'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { AddButton, RemoveButton } from '@/features/admin/ui/RepeaterControls'
import {
  NotificationPlatform,
  NotificationRecipientSource,
  NotificationRecipientType,
  OrderLinkedRecipient,
  type NotificationRecipientType as RecipientType,
  type OrderLinkedRecipient as LinkedRole,
} from '@/features/admin/types/notifications'
import type { RecipientDraft } from '../lib/notificationEventModel'
import { notificationsCopy } from '../lib/notificationsCopy'

export interface RecipientsGridProps {
  platform: NotificationPlatform
  rows: RecipientDraft[]
  /** Пусто — нет права `users.View`; селект пользователей заменяется хинтом, а уже сохранённые
   * строки печатают денормализованные `userFullName`/`userEmail` из черновика. */
  users: UserInfoModel[]
  disabled: boolean
  /** Ключ — `rowKey`. Пусто, пока не было попытки сохранения. */
  errors: Record<string, string>
  onPatch: (rowKey: string, patch: Partial<RecipientDraft>) => void
  onAdd: () => void
  onRemove: (rowKey: string) => void
}

/** Источники, допустимые для платформы. Telegram сервер ограничивает двумя: копий/скрытых копий
 * у него не бывает, а CustomEmail/AdminMailbox — email-специфичные адреса. */
const SOURCES_BY_PLATFORM: Record<NotificationPlatform, readonly NotificationRecipientSource[]> = {
  [NotificationPlatform.Email]: [
    NotificationRecipientSource.User,
    NotificationRecipientSource.OrderLinked,
    NotificationRecipientSource.CustomEmail,
    NotificationRecipientSource.AdminMailbox,
  ],
  [NotificationPlatform.Telegram]: [
    NotificationRecipientSource.User,
    NotificationRecipientSource.OrderLinked,
  ],
}

const RECIPIENT_TYPE_ORDER: readonly RecipientType[] = [
  NotificationRecipientType.To,
  NotificationRecipientType.Cc,
  NotificationRecipientType.Bcc,
]

const ORDER_LINKED_ORDER: readonly LinkedRole[] = [
  OrderLinkedRecipient.Client,
  OrderLinkedRecipient.Employee,
]

function userLabel(user: UserInfoModel): string {
  return `${user.firstName} ${user.lastName ?? ''}`.trim() || user.email
}

/**
 * Грид получателей одной платформы.
 *
 * Два правила, которые нельзя терять из виду:
 *
 * 1. PUT — declarative sync: строку, которой нет в присланном наборе, сервер УДАЛЯЕТ. Поэтому
 *    грид рендерит и возвращает ВСЕ строки, пришедшие с сервера, включая источники, которых нет
 *    в UI-чек-листе. Конкретно `AdminMailbox` засеян миграцией на «Новую бронь с сайта»: не
 *    показать эту строку = первым же сохранением снести единственного получателя заявок.
 * 2. При смене источника поля чужих источников сбрасываются — ровно то же делает сервер в
 *    `Apply(...)`; иначе строка, переключённая с «Свой адрес» на «Пользователь», потащит за
 *    собой мёртвый адрес.
 *
 * Контролы строки собираются ФУНКЦИЯМИ, возвращающими разметку, а не вложенными компонентами:
 * компонент, объявленный в теле родителя, получает новую идентичность на каждый рендер, и React
 * перемонтировал бы `Input` адреса после каждого нажатия клавиши — с потерей фокуса.
 *
 * Перетаскивания строк нет: порядок влияет только на `sortOrder`, который ни на что больше не
 * влияет — `SortableList` подключать незачем.
 */
export function RecipientsGrid({
  platform,
  rows,
  users,
  disabled,
  errors,
  onPatch,
  onAdd,
  onRemove,
}: RecipientsGridProps) {
  const copy = useCopy(notificationsCopy)
  const enums = useCopy(adminEnumsCopy)

  const isEmail = platform === NotificationPlatform.Email
  const columnCount = isEmail ? 5 : 4

  const typeOptions: SelectOption[] = RECIPIENT_TYPE_ORDER.map((type) => ({
    value: String(type),
    label: enums.notificationRecipientType[type],
  }))

  const userOptions: SelectOption[] = users.map((user) => ({
    value: String(user.id),
    label: userLabel(user),
  }))

  const orderLinkedOptions: SelectOption[] = ORDER_LINKED_ORDER.map((role) => ({
    value: String(role),
    label: enums.orderLinkedRecipient[role],
  }))

  /** Источники для селекта. Текущее значение строки добавляется, даже если для платформы оно
   * нетипично: пришедшую с сервера строку нельзя показать «без значения». */
  function sourceOptionsFor(row: RecipientDraft): SelectOption[] {
    const allowed = SOURCES_BY_PLATFORM[platform]
    const sources = allowed.includes(row.sourceType) ? allowed : [...allowed, row.sourceType]
    return sources.map((source) => ({
      value: String(source),
      label: enums.notificationRecipientSource[source],
    }))
  }

  function changeSource(row: RecipientDraft, next: NotificationRecipientSource): void {
    onPatch(row.rowKey, {
      sourceType: next,
      userId: null,
      orderLinkedRole: null,
      customEmail: '',
      // Денормализованные подписи принадлежали прежнему пользователю — оставить их значило бы
      // показывать чужое имя в строке, которая на него больше не ссылается.
      userFullName: null,
      userEmail: null,
    })
  }

  function typeControl(row: RecipientDraft, index: number): ReactNode {
    return (
      <Select
        surface="admin"
        options={typeOptions}
        value={row.type === null ? '' : String(row.type)}
        onChange={(value) => onPatch(row.rowKey, { type: Number(value) as RecipientType })}
        disabled={disabled}
        error={Boolean(errors[row.rowKey]) && row.type === null}
        aria-label={copy.rowTypeAria(index + 1)}
      />
    )
  }

  function sourceControl(row: RecipientDraft, index: number): ReactNode {
    return (
      <Select
        surface="admin"
        options={sourceOptionsFor(row)}
        value={String(row.sourceType)}
        onChange={(value) => changeSource(row, Number(value) as NotificationRecipientSource)}
        disabled={disabled}
        aria-label={copy.rowSourceAria(index + 1)}
      />
    )
  }

  /** Колонка «Получатель» — её содержимое целиком определяется источником строки. */
  function recipientControl(row: RecipientDraft, index: number): ReactNode {
    const invalid = Boolean(errors[row.rowKey])

    switch (row.sourceType) {
      case NotificationRecipientSource.User:
        // Нет права `users.View` — селект заменяется тем, что сервер уже денормализовал в
        // строку. Строка остаётся читаемой и сохраняется как была, а не ломается.
        if (users.length === 0) {
          return (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-neutral-700">
                {row.userFullName ?? row.userEmail ?? copy.userUnavailable}
              </span>
              <span className="text-xs text-neutral-400">{copy.usersNoAccessHint}</span>
            </div>
          )
        }
        return (
          <Select
            surface="admin"
            searchable
            options={userOptions}
            value={row.userId === null ? '' : String(row.userId)}
            onChange={(value) => onPatch(row.rowKey, { userId: Number(value) })}
            disabled={disabled}
            error={invalid && row.userId === null}
            aria-label={copy.rowRecipientAria(index + 1)}
          />
        )

      case NotificationRecipientSource.OrderLinked:
        return (
          <div className="flex flex-col gap-1">
            <Select
              surface="admin"
              options={orderLinkedOptions}
              value={row.orderLinkedRole === null ? '' : String(row.orderLinkedRole)}
              onChange={(value) =>
                onPatch(row.rowKey, { orderLinkedRole: Number(value) as LinkedRole })
              }
              disabled={disabled}
              error={invalid && row.orderLinkedRole === null}
              aria-label={copy.rowRecipientAria(index + 1)}
            />
            {/* Описание поведения системы, а не совет: письмо действительно уходит каждому
                исполнителю строки отдельно — это делает сервер. */}
            {row.orderLinkedRole === OrderLinkedRecipient.Employee && (
              <span className="text-xs text-neutral-400">{copy.orderLinkedEmployeeNote}</span>
            )}
          </div>
        )

      case NotificationRecipientSource.CustomEmail:
        return (
          <Input
            type="email"
            value={row.customEmail}
            placeholder={copy.customEmailPlaceholder}
            disabled={disabled}
            error={invalid}
            onChange={(e) => onPatch(row.rowKey, { customEmail: e.target.value })}
            aria-label={copy.rowRecipientAria(index + 1)}
          />
        )

      case NotificationRecipientSource.AdminMailbox:
        // Адрес живёт в конфигурации сервера — вводить нечего, но строка обязана существовать
        // и уехать обратно в PUT (см. доккоммент компонента).
        return (
          <span className="flex items-center gap-1.5 text-sm text-neutral-700">
            {copy.adminMailboxValue}
            <HelpButton surface="admin" title={copy.adminMailboxValue}>
              {copy.adminMailboxHint}
            </HelpButton>
          </span>
        )
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-neutral-900">{copy.recipientsTitle}</h3>

      {rows.length === 0 ? (
        // Осознанное состояние системы, а не ошибка: красным не красим.
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center">
          <h4 className="text-base font-semibold text-neutral-800">{copy.recipientsEmptyTitle}</h4>
          <p className="mt-1 text-sm text-neutral-500">{copy.recipientsEmptyBody}</p>
        </div>
      ) : (
        <>
          {/* ≥ sm */}
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="w-20 px-4 py-2.5 font-semibold">{copy.colActive}</th>
                  {isEmail && <th className="w-[150px] px-4 py-2.5 font-semibold">{copy.colType}</th>}
                  <th className="w-[190px] px-4 py-2.5 font-semibold">{copy.colSource}</th>
                  <th className="px-4 py-2.5 font-semibold">{copy.colRecipient}</th>
                  <th className="w-14 px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">{copy.removeRow}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <Fragment key={row.rowKey}>
                    <tr className="border-t border-neutral-100 align-top text-sm">
                      <td className="px-4 py-2.5">
                        {/* Подпись — в шапке колонки; для скринридера она всё равно нужна на
                            каждом контроле, поэтому `labelHidden`, а не отсутствие label. */}
                        <Checkbox
                          label={copy.rowActiveAria(index + 1)}
                          labelHidden
                          checked={row.isActive}
                          disabled={disabled}
                          onChange={(e) => onPatch(row.rowKey, { isActive: e.target.checked })}
                          containerClassName="mt-2"
                        />
                      </td>
                      {isEmail && <td className="px-4 py-2.5">{typeControl(row, index)}</td>}
                      <td className="px-4 py-2.5">{sourceControl(row, index)}</td>
                      <td className="px-4 py-2.5">{recipientControl(row, index)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end pt-2">
                          <RemoveButton
                            label={copy.removeRowAria(index + 1)}
                            disabled={disabled}
                            onClick={() => onRemove(row.rowKey)}
                          />
                        </div>
                      </td>
                    </tr>
                    {errors[row.rowKey] && (
                      <tr>
                        <td colSpan={columnCount} className="px-4 pb-2.5">
                          <p role="alert" className="text-xs font-medium text-rose-700">
                            {errors[row.rowKey]}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* < sm — карточка на строку: четыре-пять колонок с контролами на телефон не влезают,
              а горизонтальный скролл прячет ровно то, что надо править. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {rows.map((row, index) => (
              <li
                key={row.rowKey}
                className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {copy.rowTitle(index + 1)}
                  </span>
                  <AdminActionButton
                    label={copy.removeRow}
                    aria-label={copy.removeRowAria(index + 1)}
                    icon={<CloseIcon size={16} />}
                    variant="ghost"
                    size="md"
                    disabled={disabled}
                    onClick={() => onRemove(row.rowKey)}
                  />
                </div>

                <Checkbox
                  label={copy.colActive}
                  checked={row.isActive}
                  disabled={disabled}
                  onChange={(e) => onPatch(row.rowKey, { isActive: e.target.checked })}
                  containerClassName="min-h-11"
                />

                {isEmail && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral-500">{copy.colType}</span>
                    {typeControl(row, index)}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-neutral-500">{copy.colSource}</span>
                  {sourceControl(row, index)}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-neutral-500">{copy.colRecipient}</span>
                  {recipientControl(row, index)}
                </div>

                {errors[row.rowKey] && (
                  <p role="alert" className="text-xs font-medium text-rose-700">
                    {errors[row.rowKey]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {!disabled && <AddButton onClick={onAdd}>{copy.addRecipient}</AddButton>}
    </section>
  )
}
