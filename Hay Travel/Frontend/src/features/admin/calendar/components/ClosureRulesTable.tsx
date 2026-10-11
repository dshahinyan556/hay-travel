import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TourInfoModel } from '@/shared/types/attours'
import {
  ClosureAction,
  ClosureRuleType,
  type ClosureRuleInfoModel,
  type DayOfWeekCode,
} from '@/shared/types/booking'
import { calendarCopy, type CalendarCopy } from '../lib/calendarCopy'
import { isDraftRuleId } from '../lib/calendarDraft'
import {
  groupClosureRules,
  tourTitleResolver,
  tourTypeScopeLabel,
  type ClosureRuleGroup,
} from '../lib/calendarModel'
import { DraftTag } from './DraftTag'

export interface ClosureRulesTableProps {
  /** Saved rules AND the draft's new ones (negative ids, see `draftRuleInfo`). */
  rules: ClosureRuleInfoModel[]
  tours: TourInfoModel[]
  pending: boolean
  /** Saved rules marked for deletion in the draft — drawn struck through with «Вернуть». */
  deletedIds: ReadonlySet<number>
  /** Selected rule ids. Owned by the PAGE, because the «Удалить» button lives in its toolbar; the
   * table only draws and edits it. */
  selected: ReadonlySet<number>
  onSelectedChange: (next: Set<number>) => void
  /** «Вернуть»: unmark rules from deletion. */
  onRestore: (ids: number[]) => void
  /** «Убрать»: drop NEW draft rules (ids are the negative ones from `draftRuleInfo`). */
  onDiscardNew: (ids: number[]) => void
  /** `calendar.Delete`. Without it the table is still worth showing — it is the only place the
   * closure rules can be READ — so the selection column is what disappears. */
  canDelete: boolean
}

function describePeriod(rule: ClosureRuleInfoModel, copy: CalendarCopy): string {
  if (rule.type === ClosureRuleType.SpecificDate) return copy.dash
  const from = copy.formatTableDate(rule.effectiveFrom)
  const to = copy.formatTableDate(rule.effectiveTo)
  if (from === null && to === null) return copy.dash
  return copy.rulesPeriodRange(from, to)
}

/** Область одного правила: продукт / целый тип продукта / глобально (решение 0.27). */
function describeRuleScope(
  rule: ClosureRuleInfoModel,
  tourTitle: (id: number) => string,
  copy: CalendarCopy,
): string {
  if (rule.tourId !== null) return tourTitle(rule.tourId)
  if (rule.tourType !== null) return tourTypeScopeLabel(rule.tourType, copy)
  return copy.rulesAllTours
}

/**
 * Область for a group: the one scope every rule shares, or a count when the batch covers several.
 *
 * Батч из одной массовой операции однороден по ВИДУ области (радио «Область» исключающее), но
 * одиночное закрытие дня умеет отправить смешанный набор — типы продукта и отдельные продукты
 * разом. Поэтому: все правила про продукты → «N продуктов», иначе → «N областей»; врать одной из
 * них в сводке хуже, чем назвать число.
 */
function describeGroupScope(
  group: ClosureRuleGroup,
  tourTitle: (id: number) => string,
  copy: CalendarCopy,
): string {
  const keys = new Set(group.rules.map((rule) => `${rule.tourId}/${rule.tourType}`))
  if (keys.size === 1) return describeRuleScope(group.rules[0], tourTitle, copy)
  if (group.rules.every((rule) => rule.tourId !== null)) return copy.rulesManyTours(keys.size)
  return copy.rulesManyScopes(keys.size)
}

/** Когда for a group: a date range for `SpecificDate` batches, the set of weekdays for `Weekly`
 * ones. Type is homogeneous within a batch by construction (see `groupClosureRules`'s doc
 * comment), so reading it off the first rule is safe. */
function describeGroupWhen(group: ClosureRuleGroup, copy: CalendarCopy): string {
  const first = group.rules[0]
  if (first.type === ClosureRuleType.SpecificDate) {
    const dates = Array.from(
      new Set(group.rules.map((rule) => rule.date).filter((date): date is string => date !== null)),
    ).sort()
    if (dates.length <= 1) return copy.formatTableDate(dates[0] ?? null) ?? copy.dash
    return `${copy.formatTableDate(dates[0])} – ${copy.formatTableDate(dates[dates.length - 1])}`
  }
  const weekdays = Array.from(
    new Set(group.rules.map((rule) => rule.dayOfWeek).filter((day): day is DayOfWeekCode => day !== null)),
  ).sort((a, b) => a - b)
  if (weekdays.length === 0) return copy.dash
  if (weekdays.length === 1) return copy.weekdayEvery[weekdays[0]]
  return weekdays.map((day) => copy.weekdayShort[day]).join(', ')
}

interface RowCheckboxProps {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  ariaLabel: string
  disabled?: boolean
}

/** Row-selection checkbox — deliberately NOT `shared/ui/Checkbox` (that one always renders a
 * visible text label next to the box; a table row's selection box has none) and needs the DOM
 * `indeterminate` flag, which is not a plain HTML attribute React can set via JSX. */
function RowCheckbox({ checked, indeterminate = false, onChange, ariaLabel, disabled }: RowCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-neutral-300 text-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-0 disabled:cursor-not-allowed"
    />
  )
}

/** Text button of a draft row («Вернуть» / «Убрать») — the same look as «Вернуть» in the products
 * list: an underlined link-button, at least 44px tall on a phone. */
function DraftAction({
  label,
  ariaLabel,
  disabled,
  onClick,
}: {
  label: string
  ariaLabel: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="min-h-11 shrink-0 cursor-pointer px-1 text-xs font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0"
    >
      {label}
    </button>
  )
}

/** Shared by single rows and group summaries: what the DRAFT says about these rules. */
interface DraftState {
  total: number
  newCount: number
  deletedCount: number
}

function DraftStatusCell({
  state,
  pending,
  ariaSubject,
  onRestore,
  onDiscard,
}: {
  state: DraftState
  pending: boolean
  ariaSubject: string
  onRestore: () => void
  onDiscard: () => void
}) {
  const copy = useCopy(calendarCopy)
  const allNew = state.newCount === state.total
  const allDeleted = state.deletedCount === state.total
  return (
    <td className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {state.newCount > 0 && (
          <DraftTag tone="info">{allNew ? copy.draftNew : copy.draftNewCount(state.newCount)}</DraftTag>
        )}
        {state.deletedCount > 0 && (
          <DraftTag tone="removed">
            {allDeleted ? copy.draftWillDelete : copy.draftDeleteCount(state.deletedCount)}
          </DraftTag>
        )}
        {allNew && (
          <DraftAction
            label={copy.draftDiscard}
            ariaLabel={`${copy.draftDiscard}: ${ariaSubject}`}
            disabled={pending}
            onClick={onDiscard}
          />
        )}
        {allDeleted && (
          <DraftAction
            label={copy.draftUndo}
            ariaLabel={`${copy.draftUndo}: ${ariaSubject}`}
            disabled={pending}
            onClick={onRestore}
          />
        )}
      </div>
    </td>
  )
}

/**
 * Every closure rule, grouped by the `BatchId` one `CreateRules` call shares (F16, 2026-08-14):
 * a single toggle or a whole bulk operation reads as ONE row with an expand chevron, instead of
 * N visually identical ones. Rows carry a checkbox; deleting goes through the selection + «Удалить»
 * in the PAGE toolbar, and — since the page keeps a draft — it only MARKS saved rules «удалится»
 * (with «Вернуть») until «Сохранить». Rules added through «Добавить» show up here as «новое» and
 * can be removed again.
 *
 * Below `sm` this table scrolls HORIZONTALLY inside its own frame, same recipe as `UsersTable`.
 */
export function ClosureRulesTable({
  rules,
  tours,
  pending,
  deletedIds,
  selected,
  onSelectedChange,
  onRestore,
  onDiscardNew,
  canDelete,
}: ClosureRulesTableProps) {
  const copy = useCopy(calendarCopy)
  const { locale } = useLocale()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const tourTitle = useMemo(() => tourTitleResolver(tours, locale, copy), [tours, locale, copy])

  const groups = useMemo(
    () => groupClosureRules(rules, tourTitle, locale),
    [rules, tourTitle, locale],
  )

  /** Rows that can be selected: already-marked ones are done, there is nothing left to delete. */
  const isSelectable = (rule: ClosureRuleInfoModel): boolean => canDelete && !deletedIds.has(rule.id)

  function toggleRule(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  function toggleGroup(group: ClosureRuleGroup) {
    const ids = group.rules.filter(isSelectable).map((rule) => rule.id)
    if (ids.length === 0) return
    const allSelected = ids.every((id) => selected.has(id))
    const next = new Set(selected)
    for (const id of ids) {
      if (allSelected) next.delete(id)
      else next.add(id)
    }
    onSelectedChange(next)
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** «Вернуть» / «Убрать» also drop the affected rows from the selection — a restored or discarded
   * rule must not keep counting towards the toolbar's «Удалить». */
  function dropFromSelection(ids: number[]) {
    if (!ids.some((id) => selected.has(id))) return
    const next = new Set(selected)
    for (const id of ids) next.delete(id)
    onSelectedChange(next)
  }

  function restore(ids: number[]) {
    onRestore(ids)
    dropFromSelection(ids)
  }

  function discard(ids: number[]) {
    onDiscardNew(ids)
    dropFromSelection(ids)
  }

  if (rules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-neutral-500">{copy.rulesEmpty}</p>
        <p className="mt-1 text-xs text-neutral-400">{copy.rulesEmptyHint}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <th className="w-10 px-4 py-2.5" />
            <th className="px-2 py-2.5 font-semibold">{copy.rulesScope}</th>
            <th className="w-[130px] px-4 py-2.5 font-semibold">{copy.rulesType}</th>
            <th className="w-[190px] px-4 py-2.5 font-semibold">{copy.rulesWhen}</th>
            <th className="w-[190px] px-4 py-2.5 font-semibold">{copy.rulesPeriod}</th>
            <th className="w-[110px] px-4 py-2.5 font-semibold">{copy.rulesAction}</th>
            <th className="px-4 py-2.5 font-semibold">{copy.rulesReason}</th>
            <th className="w-[150px] px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) =>
            group.rules.length === 1 ? (
              <RuleRow
                key={group.key}
                rule={group.rules[0]}
                tourTitle={tourTitle}
                selected={selected.has(group.rules[0].id)}
                deleted={deletedIds.has(group.rules[0].id)}
                pending={pending}
                onToggle={() => toggleRule(group.rules[0].id)}
                selectable={canDelete}
                onRestore={() => restore([group.rules[0].id])}
                onDiscard={() => discard([group.rules[0].id])}
              />
            ) : (
              <GroupRows
                key={group.key}
                group={group}
                tourTitle={tourTitle}
                selected={selected}
                deletedIds={deletedIds}
                pending={pending}
                expanded={expanded.has(group.key)}
                onToggleExpanded={() => toggleExpanded(group.key)}
                onToggleGroup={() => toggleGroup(group)}
                onToggleRule={toggleRule}
                selectable={canDelete}
                onRestore={restore}
                onDiscard={discard}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

interface RuleRowProps {
  rule: ClosureRuleInfoModel
  tourTitle: (id: number) => string
  selected: boolean
  /** Saved rule marked for deletion in the draft. */
  deleted: boolean
  pending: boolean
  onToggle: () => void
  /** `calendar.Delete` — selection exists only to delete, so without it the box is inert. */
  selectable: boolean
  onRestore: () => void
  onDiscard: () => void
  /** Nested inside an expanded group — slightly indented/muted so it reads as a child, not a
   * peer of the group summary row above it. */
  nested?: boolean
}

function RuleRow({
  rule,
  tourTitle,
  selected,
  deleted,
  pending,
  onToggle,
  selectable,
  onRestore,
  onDiscard,
  nested = false,
}: RuleRowProps) {
  const copy = useCopy(calendarCopy)
  const isDate = rule.type === ClosureRuleType.SpecificDate
  const isNew = isDraftRuleId(rule.id)
  // Struck-through and muted: the row stays where it was so «Вернуть» puts it back in place.
  const struck = deleted ? 'line-through opacity-55' : ''
  const subject = copy.formatTableDate(rule.date) ?? String(rule.id)
  return (
    <tr className={`border-t border-neutral-100 text-sm ${nested ? 'bg-neutral-50/60' : ''}`}>
      <td className="px-4 py-2.5">
        <RowCheckbox
          checked={selected && !deleted}
          onChange={onToggle}
          disabled={!selectable || deleted || pending}
          ariaLabel={copy.rulesSelectAria(subject)}
        />
      </td>
      <td className={`px-2 py-2.5 text-neutral-900 ${nested ? 'pl-8' : ''} ${struck}`}>
        {/* Полужирным — области шире одного продукта: глобальная и «весь тип продукта». Строка
            про конкретный продукт остаётся обычной и обрезается по ширине колонки. */}
        {rule.tourId === null ? (
          <span className="font-semibold">{describeRuleScope(rule, tourTitle, copy)}</span>
        ) : (
          <span className="block max-w-[240px] truncate" title={tourTitle(rule.tourId)}>
            {tourTitle(rule.tourId)}
          </span>
        )}
      </td>
      <td className={`px-4 py-2.5 text-neutral-700 ${struck}`}>
        {isDate ? copy.rulesTypeDate : copy.rulesTypeWeekly}
      </td>
      <td className={`px-4 py-2.5 tabular-nums text-neutral-700 ${struck}`}>
        {isDate
          ? (copy.formatTableDate(rule.date) ?? copy.dash)
          : rule.dayOfWeek !== null
            ? copy.weekdayEvery[rule.dayOfWeek]
            : copy.dash}
      </td>
      <td className={`px-4 py-2.5 tabular-nums text-neutral-700 ${struck}`}>{describePeriod(rule, copy)}</td>
      <td className={`px-4 py-2.5 ${struck}`}>
        <ActionBadge action={rule.action} />
      </td>
      <td className={`max-w-[260px] px-4 py-2.5 text-neutral-500 ${struck}`}>
        <span className="block truncate" title={rule.reason ?? undefined}>
          {rule.reason ?? copy.dash}
        </span>
      </td>
      <DraftStatusCell
        state={{ total: 1, newCount: isNew ? 1 : 0, deletedCount: deleted ? 1 : 0 }}
        pending={pending}
        ariaSubject={subject}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />
    </tr>
  )
}

function ActionBadge({ action }: { action: ClosureAction }) {
  const copy = useCopy(calendarCopy)
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        action === ClosureAction.Close
          ? 'bg-neutral-900 text-white'
          : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
      }`}
    >
      {action === ClosureAction.Close ? copy.rulesActionClose : copy.rulesActionOpen}
    </span>
  )
}

interface GroupRowsProps {
  group: ClosureRuleGroup
  tourTitle: (id: number) => string
  selected: ReadonlySet<number>
  deletedIds: ReadonlySet<number>
  pending: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onToggleGroup: () => void
  onToggleRule: (id: number) => void
  /** `calendar.Delete` — see `RuleRowProps.selectable`. */
  selectable: boolean
  onRestore: (ids: number[]) => void
  onDiscard: (ids: number[]) => void
}

function GroupRows({
  group,
  tourTitle,
  selected,
  deletedIds,
  pending,
  expanded,
  onToggleExpanded,
  onToggleGroup,
  onToggleRule,
  selectable,
  onRestore,
  onDiscard,
}: GroupRowsProps) {
  const copy = useCopy(calendarCopy)
  const first = group.rules[0]
  const isDate = first.type === ClosureRuleType.SpecificDate
  const ids = group.rules.map((rule) => rule.id)
  const selectableIds = ids.filter((id) => !deletedIds.has(id))
  const selectedCount = selectableIds.filter((id) => selected.has(id)).length
  const deletedCount = ids.length - selectableIds.length
  const newCount = ids.filter(isDraftRuleId).length
  const allDeleted = deletedCount === ids.length
  const struck = allDeleted ? 'line-through opacity-55' : ''
  const summary = describeGroupScope(group, tourTitle, copy)

  return (
    <>
      <tr className="border-t border-neutral-100 bg-neutral-50/40 text-sm">
        <td className="px-4 py-2.5">
          <RowCheckbox
            checked={selectableIds.length > 0 && selectedCount === selectableIds.length}
            indeterminate={selectedCount > 0 && selectedCount < selectableIds.length}
            onChange={onToggleGroup}
            disabled={!selectable || selectableIds.length === 0 || pending}
            ariaLabel={copy.rulesSelectGroupAria(ids.length)}
          />
        </td>
        <td className={`px-2 py-2.5 text-neutral-900 ${struck}`}>
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-label={expanded ? copy.rulesGroupCollapse : copy.rulesGroupExpand}
            className="flex min-w-0 cursor-pointer items-center gap-1.5 font-semibold hover:text-neutral-900"
          >
            <ChevronDownIcon
              size={15}
              className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            <span className="truncate">{summary}</span>
            <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
              {ids.length}
            </span>
          </button>
        </td>
        <td className={`px-4 py-2.5 text-neutral-700 ${struck}`}>
          {isDate ? copy.rulesTypeDate : copy.rulesTypeWeekly}
        </td>
        <td className={`px-4 py-2.5 tabular-nums text-neutral-700 ${struck}`}>{describeGroupWhen(group, copy)}</td>
        <td className={`px-4 py-2.5 tabular-nums text-neutral-700 ${struck}`}>{describePeriod(first, copy)}</td>
        <td className={`px-4 py-2.5 ${struck}`}>
          <ActionBadge action={first.action} />
        </td>
        <td className={`max-w-[260px] px-4 py-2.5 text-neutral-500 ${struck}`}>
          <span className="block truncate" title={first.reason ?? undefined}>
            {first.reason ?? copy.dash}
          </span>
        </td>
        <DraftStatusCell
          state={{ total: ids.length, newCount, deletedCount }}
          pending={pending}
          ariaSubject={summary}
          onRestore={() => onRestore(ids.filter((id) => deletedIds.has(id)))}
          onDiscard={() => onDiscard(ids.filter(isDraftRuleId))}
        />
      </tr>
      {expanded &&
        group.rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            tourTitle={tourTitle}
            selected={selected.has(rule.id)}
            deleted={deletedIds.has(rule.id)}
            pending={pending}
            onToggle={() => onToggleRule(rule.id)}
            selectable={selectable}
            onRestore={() => onRestore([rule.id])}
            onDiscard={() => onDiscard([rule.id])}
            nested
          />
        ))}
    </>
  )
}
