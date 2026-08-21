import { ClockIcon } from '@/shared/ui/icons'
import type { OrderEventInfoModel } from '@/shared/types/booking'
import { eventTypeTagLabels, ordersCopy } from '../lib/ordersCopy'

export interface OrderHistoryTabProps {
  events: OrderEventInfoModel[]
}

/**
 * "История" tab (checklist §7) — pure readonly audit-log timeline, no buttons/links/filters/
 * expansion anywhere on it. `description` is a ready-made Russian sentence from the server; this
 * component only lays it out (date column, dot-and-rail, description, author, type tag), it never
 * reconstructs event text itself. Newest event first — the server already sorts that way.
 *
 * Layout matches the approved mockup's §D table: a 132px date column + a dot rail + the text,
 * collapsing to a two-column (rail + text, date moves into the byline) layout below `sm`.
 */
export function OrderHistoryTab({ events }: OrderHistoryTabProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center">
        <ClockIcon size={26} className="text-neutral-300" />
        <p className="text-sm font-semibold text-neutral-900">{ordersCopy.historyEmptyTitle}</p>
        <p className="max-w-xs text-sm text-neutral-500">{ordersCopy.historyEmptyBody}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4">
      {events.map((event, index) => (
        <div
          key={event.id}
          className={`grid grid-cols-[22px_minmax(0,1fr)] gap-x-2.5 gap-y-0 py-3 sm:grid-cols-[132px_22px_minmax(0,1fr)] ${
            index > 0 ? 'border-t border-neutral-100' : ''
          }`}
        >
          <time
            dateTime={event.createdAtUtc}
            className="col-start-2 row-start-1 hidden text-xs tabular-nums whitespace-nowrap text-neutral-500 sm:col-start-1 sm:block"
          >
            {new Date(event.createdAtUtc).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
          <div className="relative col-start-1 row-span-1 flex justify-center sm:col-start-2">
            <span
              aria-hidden="true"
              className={`mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full ${
                index === 0 ? 'bg-neutral-900' : 'bg-white shadow-[inset_0_0_0_1.5px_theme(colors.neutral.400)]'
              }`}
            />
          </div>
          <div className="col-start-2 text-[13.5px] leading-relaxed text-neutral-900 sm:col-start-3">
            {event.description}
            <span className="ml-2 inline-block rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 align-middle text-[9.5px] font-bold tracking-[.1em] text-neutral-500 uppercase">
              {eventTypeTagLabels[event.type]}
            </span>
            <span className="block text-xs text-neutral-500 sm:mt-0.5">
              {ordersCopy.historyAuthorLabel}:{' '}
              <span className="font-semibold text-neutral-700">
                {event.actorFullName?.trim() || ordersCopy.historySystemActor}
              </span>
              <time dateTime={event.createdAtUtc} className="tabular-nums sm:hidden">
                {' · '}
                {new Date(event.createdAtUtc).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
