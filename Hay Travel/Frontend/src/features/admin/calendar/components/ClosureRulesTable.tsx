import { useMemo, useRef, useState, useEffect } from 'react'
import { Button, Modal } from '@/shared/ui'
import { ChevronDownIcon } from '@/shared/ui/icons'
import { parseISODate } from '@/shared/lib/date'
import type { TourInfoModel } from '@/shared/types/attours'
import {
  ClosureAction,
  ClosureRuleType,
  type ClosureRuleInfoModel,
  type DayOfWeekCode,
} from '@/shared/types/booking'
import { calendarCopy, weekdayLabels, weekdayLabelsEvery } from '../lib/calendarCopy'
import { groupClosureRules, tourTitleResolver, type ClosureRuleGroup } from '../lib/calendarModel'

export interface ClosureRulesTableProps {
  rules: ClosureRuleInfoModel[]
  tours: TourInfoModel[]
  pending: boolean
  /** Fires with every id to delete — a whole group (2026-08-14: checkbox selection replaces the
   * old one-button-per-row delete) or an arbitrary multi-select, the caller does not need to
   * know which. */
  onDeleteSelected: (ids: number[]) => void
}

/** `12.08.2026` — the format the panel uses everywhere a date is tabular. */
function formatRu(dateISO: string | null): string | null {
  if (dateISO === null) return null
  const date = parseISODate(dateISO)
  if (date === null) return dateISO
  return date.toLocaleDateString('ru-RU')
}

function describePeriod(rule: ClosureRuleInfoModel): string {
  if (rule.type === ClosureRuleType.SpecificDate) return calendarCopy.dash
  const from = formatRu(rule.effectiveFrom)
  const to = formatRu(rule.effectiveTo)
  if (from === null && to === null) return calendarCopy.dash
  return `${from === null ? '…' : `с ${from}`} ${to === null ? '' : `по ${to}`}`.trim()
}

/** Область for a group: the one tour/global scope every rule shares, or a count when the batch
 * covers several tours (a global rule can never mix with tour-scoped ones in the same batch —
 * `BulkClosurePanel`'s scope radio and `DayClosureControls`' `tourIds` are both exclusive). */
function describeGroupScope(group: ClosureRuleGroup, tourTitle: (id: number) => string): string {
  const tourIds = Array.from(new Set(group.rules.map((rule) => rule.tourId)))
  if (tourIds.length === 1) {
    const only = tourIds[0]
    return only === null ? calendarCopy.rulesAllTours : tourTitle(only)
  }
  return calendarCopy.rulesManyTours(tourIds.length)
}

/** Когда for a group: a date range for `SpecificDate` batches, the set of weekdays for `Weekly`
 * ones. Type is homogeneous within a batch by construction (see `groupClosureRules`'s doc
 * comment), so reading it off the first rule is safe. */
function describeGroupWhen(group: ClosureRuleGroup): string {
  const first = group.rules[0]
  if (first.type === ClosureRuleType.SpecificDate) {
    const dates = Array.from(
      new Set(group.rules.map((rule) => rule.date).filter((date): date is string => date !== null)),
    ).sort()
    if (dates.length <= 1) return formatRu(dates[0] ?? null) ?? calendarCopy.dash
    return `${formatRu(dates[0])} – ${formatRu(dates[dates.length - 1])}`
  }
  const weekdays = Array.from(
    new Set(group.rules.map((rule) => rule.dayOfWeek).filter((day): day is DayOfWeekCode => day !== null)),
  ).sort((a, b) => a - b)
  if (weekdays.length === 0) return calendarCopy.dash
  if (weekdays.length === 1) return weekdayLabelsEvery[weekdays[0]]
  return weekdays.map((day) => weekdayLabels[day]).join(', ')
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
      className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-neutral-300 text-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:ring-offset-0 disabled:cursor-not-allowed"
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
export function ClosureRulesTable({ rules, tours, pending, onDeleteSelected }: ClosureRulesTableProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const tourTitle = useMemo(() => tourTitleResolver(tours), [tours])

  const groups = useMemo(() => groupClosureRules(rules, tourTitle), [rules, tourTitle])

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
        <p className="text-sm text-neutral-500">{calendarCopy.rulesEmpty}</p>
        <p className="mt-1 text-xs text-neutral-400">{calendarCopy.rulesEmptyHint}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
            <span className="text-sm font-semibold text-brand-800">
              {calendarCopy.rulesSelectedCount(selected.size)}
            </span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="min-h-11"
            >
              {calendarCopy.rulesDeleteSelected}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-4 py-2.5" />
                <th className="px-2 py-2.5 font-semibold">{calendarCopy.rulesScope}</th>
                <th className="w-[130px] px-4 py-2.5 font-semibold">{calendarCopy.rulesType}</th>
                <th className="w-[190px] px-4 py-2.5 font-semibold">{calendarCopy.rulesWhen}</th>
                <th className="w-[190px] px-4 py-2.5 font-semibold">{calendarCopy.rulesPeriod}</th>
                <th className="w-[110px] px-4 py-2.5 font-semibold">{calendarCopy.rulesAction}</th>
                <th className="px-4 py-2.5 font-semibold">{calendarCopy.rulesReason}</th>
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
        title={calendarCopy.rulesDeleteTitle(selected.size)}
      >
        <p className="text-sm text-neutral-600">{calendarCopy.rulesDeleteBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {calendarCopy.bulkCancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={confirmDelete}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? calendarCopy.rulesDeleting : calendarCopy.rulesDeleteConfirm}
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
  /** Nested inside an expanded group — slightly indented/muted so it reads as a child, not a
   * peer of the group summary row above it. */
  nested?: boolean
}

function RuleRow({ rule, tourTitle, selected, onToggle, nested = false }: RuleRowProps) {
  const isDate = rule.type === ClosureRuleType.SpecificDate
  return (
    <tr className={`border-t border-neutral-100 text-sm ${nested ? 'bg-neutral-50/60' : ''}`}>
      <td className="px-4 py-2.5">
        <RowCheckbox
          checked={selected}
          onChange={onToggle}
          ariaLabel={`Выбрать блокировку от ${formatRu(rule.date) ?? rule.id}`}
        />
      </td>
      <td className={`px-2 py-2.5 text-neutral-900 ${nested ? 'pl-8' : ''}`}>
        {rule.tourId === null ? (
          <span className="font-semibold">{calendarCopy.rulesAllTours}</span>
        ) : (
          <span className="block max-w-[240px] truncate" title={tourTitle(rule.tourId)}>
            {tourTitle(rule.tourId)}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-neutral-700">
        {isDate ? calendarCopy.rulesTypeDate : calendarCopy.rulesTypeWeekly}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-neutral-700">
        {isDate
          ? (formatRu(rule.date) ?? calendarCopy.dash)
          : rule.dayOfWeek !== null
            ? weekdayLabelsEvery[rule.dayOfWeek]
            : calendarCopy.dash}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-neutral-700">{describePeriod(rule)}</td>
      <td className="px-4 py-2.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            rule.action === ClosureAction.Close
              ? 'bg-rose-50 text-rose-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {rule.action === ClosureAction.Close ? calendarCopy.rulesActionClose : calendarCopy.rulesActionOpen}
        </span>
      </td>
      <td className="max-w-[260px] px-4 py-2.5 text-neutral-500">
        <span className="block truncate" title={rule.reason ?? undefined}>
          {rule.reason ?? calendarCopy.dash}
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
}

function GroupRows({
  group,
  tourTitle,
  selected,
  expanded,
  onToggleExpanded,
  onToggleGroup,
  onToggleRule,
}: GroupRowsProps) {
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
            ariaLabel={`Выбрать группу из ${ids.length}`}
          />
        </td>
        <td className="px-2 py-2.5 text-neutral-900">
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-label={expanded ? calendarCopy.rulesGroupCollapse : calendarCopy.rulesGroupExpand}
            className="flex min-w-0 cursor-pointer items-center gap-1.5 font-semibold hover:text-brand-700"
          >
            <ChevronDownIcon
              size={15}
              className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            <span className="truncate">{describeGroupScope(group, tourTitle)}</span>
            <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
              {ids.length}
            </span>
          </button>
        </td>
        <td className="px-4 py-2.5 text-neutral-700">
          {isDate ? calendarCopy.rulesTypeDate : calendarCopy.rulesTypeWeekly}
        </td>
        <td className="px-4 py-2.5 tabular-nums text-neutral-700">{describeGroupWhen(group)}</td>
        <td className="px-4 py-2.5 tabular-nums text-neutral-700">{describePeriod(first)}</td>
        <td className="px-4 py-2.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              first.action === ClosureAction.Close
                ? 'bg-rose-50 text-rose-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {first.action === ClosureAction.Close ? calendarCopy.rulesActionClose : calendarCopy.rulesActionOpen}
          </span>
        </td>
        <td className="max-w-[260px] px-4 py-2.5 text-neutral-500">
          <span className="block truncate" title={first.reason ?? undefined}>
            {first.reason ?? calendarCopy.dash}
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
            nested
          />
        ))}
    </>
  )
}
