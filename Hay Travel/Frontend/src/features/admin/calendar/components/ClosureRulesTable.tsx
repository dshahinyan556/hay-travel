import { useMemo, useRef, useState, useEffect } from 'react'
import { Button, Modal } from '@/shared/ui'
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
import {
  groupClosureRules,
  tourTitleResolver,
  tourTypeScopeLabel,
  type ClosureRuleGroup,
} from '../lib/calendarModel'

export interface ClosureRulesTableProps {
  rules: ClosureRuleInfoModel[]
  tours: TourInfoModel[]
  pending: boolean
  /** Fires with every id to delete — a whole group (2026-08-14: checkbox selection replaces the
   * old one-button-per-row delete) or an arbitrary multi-select, the caller does not need to
   * know which. */
  onDeleteSelected: (ids: number[]) => void
  /** `calendar.Delete`. Without it the table is still worth showing — it is the only place the
   * closure rules can be READ — so the selection column and the delete bar are what disappear. */
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

/**
 * Every closure rule, grouped by the `BatchId` one `CreateRules` call shares (F16, 2026-08-14):
 * a single toggle or a whole bulk operation reads as ONE row with an expand chevron, instead of
 * N visually identical ones. Rows carry a checkbox instead of a per-row delete button — deleting
 * now always goes through the selection + the one «Удалить выбранное» action below the table,
 * whether that selection is a whole group (its own checkbox selects every child at once) or an
 * arbitrary multi-select across groups.
 *
 * Below `sm` this table scrolls HORIZONTALLY inside its own frame, same recipe as `UsersTable`.
 */
export function ClosureRulesTable({
  rules,
  tours,
  pending,
  onDeleteSelected,
  canDelete,
}: ClosureRulesTableProps) {
  const copy = useCopy(calendarCopy)
  const { locale } = useLocale()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const tourTitle = useMemo(() => tourTitleResolver(tours, locale, copy), [tours, locale, copy])

  const groups = useMemo(
    () => groupClosureRules(rules, tourTitle, locale),
    [rules, tourTitle, locale],
  )

  // A rule that's since been deleted elsewhere (another tab, a group delete) must not linger in
  // the selection — otherwise the count badge and the confirm dialog would lie about what's left.
  const knownIds = useMemo(() => new Set(rules.map((rule) => rule.id)), [rules])
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => knownIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [knownIds])

  function toggleRule(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(group: ClosureRuleGroup) {
    const ids = group.rules.map((rule) => rule.id)
    const allSelected = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function confirmDelete() {
    onDeleteSelected([...selected])
    setSelected(new Set())
    setConfirming(false)
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
    <>
      <div className="flex flex-col gap-3">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-neutral-900">
              {copy.rulesSelectedCount(selected.size)}
            </span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="min-h-11"
            >
              {copy.rulesDeleteSelected}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-4 py-2.5" />
                <th className="px-2 py-2.5 font-semibold">{copy.rulesScope}</th>
                <th className="w-[130px] px-4 py-2.5 font-semibold">{copy.rulesType}</th>
                <th className="w-[190px] px-4 py-2.5 font-semibold">{copy.rulesWhen}</th>
                <th className="w-[190px] px-4 py-2.5 font-semibold">{copy.rulesPeriod}</th>
                <th className="w-[110px] px-4 py-2.5 font-semibold">{copy.rulesAction}</th>
                <th className="px-4 py-2.5 font-semibold">{copy.rulesReason}</th>
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
                    onToggle={() => toggleRule(group.rules[0].id)}
                    selectable={canDelete}
                  />
                ) : (
                  <GroupRows
                    key={group.key}
                    group={group}
                    tourTitle={tourTitle}
                    selected={selected}
                    expanded={expanded.has(group.key)}
                    onToggleExpanded={() => toggleExpanded(group.key)}
                    onToggleGroup={() => toggleGroup(group)}
                    onToggleRule={toggleRule}
                    selectable={canDelete}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={copy.rulesDeleteTitle(selected.size)}
      >
        <p className="text-sm text-neutral-600">{copy.rulesDeleteBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.bulkCancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={confirmDelete}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? copy.rulesDeleting : copy.rulesDeleteConfirm}
          </Button>
        </div>
      </Modal>
    </>
  )
}

interface RuleRowProps {
  rule: ClosureRuleInfoModel
  tourTitle: (id: number) => string
  selected: boolean
  onToggle: () => void
  /** `calendar.Delete` — selection exists only to delete, so without it the box is inert. */
  selectable: boolean
  /** Nested inside an expanded group — slightly indented/muted so it reads as a child, not a
   * peer of the group summary row above it. */
  nested?: boolean
}

function RuleRow({ rule, tourTitle, selected, onToggle, selectable, nested = false }: RuleRowProps) {
  const copy = useCopy(calendarCopy)
  const isDate = rule.type === ClosureRuleType.SpecificDate
  return (
    <tr className={`border-t border-neutral-100 text-sm ${nested ? 'bg-neutral-50/60' : ''}`}>
      <td className="px-4 py-2.5">
        <RowCheckbox
          checked={selected}
          onChange={onToggle}
          disabled={!selectable}
          ariaLabel={copy.rulesSelectAria(copy.formatTableDate(rule.date) ?? String(rule.id))}
        />
      </td>
      <td className={`px-2 py-2.5 text-neutral-900 ${nested ? 'pl-8' : ''}`}>
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
      <td className="px-4 py-2.5 text-neutral-700">
        {isDate ? copy.rulesTypeDate : copy.rulesTypeWeekly}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-neutral-700">
        {isDate
          ? (copy.formatTableDate(rule.date) ?? copy.dash)
          : rule.dayOfWeek !== null
            ? copy.weekdayEvery[rule.dayOfWeek]
            : copy.dash}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-neutral-700">{describePeriod(rule, copy)}</td>
      <td className="px-4 py-2.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            rule.action === ClosureAction.Close
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
          }`}
        >
          {rule.action === ClosureAction.Close ? copy.rulesActionClose : copy.rulesActionOpen}
        </span>
      </td>
      <td className="max-w-[260px] px-4 py-2.5 text-neutral-500">
        <span className="block truncate" title={rule.reason ?? undefined}>
          {rule.reason ?? copy.dash}
        </span>
      </td>
    </tr>
  )
}

interface GroupRowsProps {
  group: ClosureRuleGroup
  tourTitle: (id: number) => string
  selected: Set<number>
  expanded: boolean
  onToggleExpanded: () => void
  onToggleGroup: () => void
  onToggleRule: (id: number) => void
  /** `calendar.Delete` — see `RuleRowProps.selectable`. */
  selectable: boolean
}

function GroupRows({
  group,
  tourTitle,
  selected,
  expanded,
  onToggleExpanded,
  onToggleGroup,
  onToggleRule,
  selectable,
}: GroupRowsProps) {
  const copy = useCopy(calendarCopy)
  const first = group.rules[0]
  const isDate = first.type === ClosureRuleType.SpecificDate
  const ids = group.rules.map((rule) => rule.id)
  const selectedCount = ids.filter((id) => selected.has(id)).length

  return (
    <>
      <tr className="border-t border-neutral-100 bg-neutral-50/40 text-sm">
        <td className="px-4 py-2.5">
          <RowCheckbox
            checked={selectedCount === ids.length}
            indeterminate={selectedCount > 0 && selectedCount < ids.length}
            onChange={onToggleGroup}
            disabled={!selectable}
            ariaLabel={copy.rulesSelectGroupAria(ids.length)}
          />
        </td>
        <td className="px-2 py-2.5 text-neutral-900">
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
            <span className="truncate">{describeGroupScope(group, tourTitle, copy)}</span>
            <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
              {ids.length}
            </span>
          </button>
        </td>
        <td className="px-4 py-2.5 text-neutral-700">
          {isDate ? copy.rulesTypeDate : copy.rulesTypeWeekly}
        </td>
        <td className="px-4 py-2.5 tabular-nums text-neutral-700">{describeGroupWhen(group, copy)}</td>
        <td className="px-4 py-2.5 tabular-nums text-neutral-700">{describePeriod(first, copy)}</td>
        <td className="px-4 py-2.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              first.action === ClosureAction.Close
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
            }`}
          >
            {first.action === ClosureAction.Close ? copy.rulesActionClose : copy.rulesActionOpen}
          </span>
        </td>
        <td className="max-w-[260px] px-4 py-2.5 text-neutral-500">
          <span className="block truncate" title={first.reason ?? undefined}>
            {first.reason ?? copy.dash}
          </span>
        </td>
      </tr>
      {expanded &&
        group.rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            tourTitle={tourTitle}
            selected={selected.has(rule.id)}
            onToggle={() => onToggleRule(rule.id)}
            selectable={selectable}
            nested
          />
        ))}
    </>
  )
}
