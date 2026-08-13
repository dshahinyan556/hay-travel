import { useMemo, useState } from 'react'
import { Button, Modal } from '@/shared/ui'
import { parseISODate } from '@/shared/lib/date'
import type { TourInfoModel } from '@/shared/types/attours'
import {
  ClosureAction,
  ClosureRuleType,
  type ClosureRuleInfoModel,
} from '@/shared/types/booking'
import { calendarCopy, weekdayLabelsEvery } from '../lib/calendarCopy'
import { tourTitleResolver } from '../lib/calendarModel'

export interface ClosureRulesTableProps {
  rules: ClosureRuleInfoModel[]
  tours: TourInfoModel[]
  pending: boolean
  onDelete: (id: number) => void
}

/** `12.08.2026` — the format the panel uses everywhere a date is tabular. */
function formatRu(dateISO: string | null): string | null {
  if (dateISO === null) return null
  const date = parseISODate(dateISO)
  if (date === null) return dateISO
  return date.toLocaleDateString('ru-RU')
}

/**
 * Every closure rule, ordered global-first and then by tour name, so the rules with the widest
 * blast radius are read first.
 *
 * There is no edit action, by design: the backend only creates and deletes rules (spec 001 §8) —
 * editing one would be a delete plus a create, which is exactly what the admin can already do
 * visibly.
 *
 * Below `sm` this table scrolls HORIZONTALLY inside its own frame, the same recipe as
 * `UsersTable`. A card layout for narrow screens is deliberately not invented here: the panel has
 * none anywhere else, and a second way of presenting a table is a maintenance surface for one
 * screen's benefit. The month grid, by contrast, must fit — only this frame scrolls.
 */
export function ClosureRulesTable({ rules, tours, pending, onDelete }: ClosureRulesTableProps) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const tourTitle = useMemo(() => tourTitleResolver(tours), [tours])

  const sorted = useMemo(() => {
    return [...rules].sort((a, b) => {
      if ((a.tourId === null) !== (b.tourId === null)) return a.tourId === null ? -1 : 1
      if (a.tourId !== null && b.tourId !== null && a.tourId !== b.tourId) {
        return tourTitle(a.tourId).localeCompare(tourTitle(b.tourId), 'ru')
      }
      if (a.type !== b.type) return a.type === ClosureRuleType.SpecificDate ? -1 : 1
      if (a.type === ClosureRuleType.SpecificDate) return (a.date ?? '').localeCompare(b.date ?? '')
      return (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0)
    })
  }, [rules, tourTitle])

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
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-semibold">{calendarCopy.rulesScope}</th>
              <th className="w-[130px] px-4 py-2.5 font-semibold">{calendarCopy.rulesType}</th>
              <th className="w-[170px] px-4 py-2.5 font-semibold">{calendarCopy.rulesWhen}</th>
              <th className="w-[190px] px-4 py-2.5 font-semibold">{calendarCopy.rulesPeriod}</th>
              <th className="w-[110px] px-4 py-2.5 font-semibold">{calendarCopy.rulesAction}</th>
              <th className="px-4 py-2.5 font-semibold">{calendarCopy.rulesReason}</th>
              <th className="w-[110px] px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((rule) => {
              const isDate = rule.type === ClosureRuleType.SpecificDate
              const from = formatRu(rule.effectiveFrom)
              const to = formatRu(rule.effectiveTo)
              const period =
                from === null && to === null
                  ? calendarCopy.dash
                  : `${from === null ? '…' : `с ${from}`} ${to === null ? '' : `по ${to}`}`.trim()
              return (
                <tr key={rule.id} className="border-t border-neutral-100 text-sm">
                  <td className="px-4 py-2.5 text-neutral-900">
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
                  <td className="px-4 py-2.5 tabular-nums text-neutral-700">
                    {isDate ? calendarCopy.dash : period}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        rule.action === ClosureAction.Close
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {rule.action === ClosureAction.Close
                        ? calendarCopy.rulesActionClose
                        : calendarCopy.rulesActionOpen}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-4 py-2.5 text-neutral-500">
                    <span className="block truncate" title={rule.reason ?? undefined}>
                      {rule.reason ?? calendarCopy.dash}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline-danger"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirmingId(rule.id)}
                      className="min-h-11"
                    >
                      {calendarCopy.rulesDelete}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* One dialog per table, not per row — deleting a rule can re-open weeks of days at once,
          which is not a small action. */}
      <Modal
        open={confirmingId !== null}
        onClose={() => setConfirmingId(null)}
        title={calendarCopy.rulesDeleteTitle}
      >
        <p className="text-sm text-neutral-600">{calendarCopy.rulesDeleteBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmingId(null)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {calendarCopy.bulkCancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (confirmingId === null) return
              onDelete(confirmingId)
              setConfirmingId(null)
            }}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? calendarCopy.rulesDeleting : calendarCopy.rulesDeleteConfirm}
          </Button>
        </div>
      </Modal>
    </>
  )
}
