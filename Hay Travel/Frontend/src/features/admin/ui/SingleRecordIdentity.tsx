import type { ReactNode } from 'react'

export interface SingleRecordIdentityProps {
  /** What is being edited — conventionally the same words as the screen title. */
  name: string
  /** The "one record, forever" badge («единственная запись»). Passed in, never baked in: this
   * component carries no copy of its own, the calling feature owns its wording and its language. */
  badge: string
  /** Right-aligned muted note — the record's scope («4 письма») or when it last changed. */
  note?: ReactNode
}

/**
 * Content of `SetupFormLayout`'s `identity` slot (designer proposal `admin-page-templates.html`
 * §C, pin 1) — the one genuinely new element of the page-template system: it makes the "exactly
 * one record ever" rule visible instead of merely enforced by routing.
 *
 * Renders a FRAGMENT, not a card: the card chrome (border, padding, `flex items-center gap-3`)
 * belongs to `SetupFormLayout` itself, so both template-C screens get the identical strip and
 * neither can drift. Lives in `features/admin/ui/` rather than under one feature because both
 * `settings/` and `notifications/` use it — same rule `EmployeeJobRoleSelect` already follows.
 */
export function SingleRecordIdentity({ name, badge, note }: SingleRecordIdentityProps) {
  return (
    <>
      <span className="text-sm font-bold text-neutral-900">{name}</span>
      <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-neutral-700">
        {badge}
      </span>
      {note !== undefined && <span className="ml-auto text-xs text-neutral-500">{note}</span>}
    </>
  )
}
