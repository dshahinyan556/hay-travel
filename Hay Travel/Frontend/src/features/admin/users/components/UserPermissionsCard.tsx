import { useState } from 'react'
import { Accordion, Button, Card } from '@/shared/ui'
import type { AccessLevel } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { PermissionMatrix, type PermissionMatrixRow } from '@/features/admin/ui/PermissionMatrix'
import { rolesCopy } from '@/features/admin/roles/lib/rolesCopy'

export interface UserPermissionsCardProps {
  /** Role name — for the "inherits from «X»" summary. */
  roleName: string
  /** Rows to render — the page's draft when the matrix was touched, the saved state otherwise.
   * `null` when the screens registry, the role matrix or the overrides could not be loaded. */
  rows: PermissionMatrixRow[] | null
  /** How many overrides are SAVED — the collapsed header's summary speaks about the account as it
   * is, not about the unsaved draft. */
  savedOverrideCount: number
  /** `users.Update`, already narrowed by the page's SuperAdmin lock (`canEditUser`, 2026-08-27) —
   * without it the block is readable but not editable, which is exactly what the backend's
   * `PermissionOverrides` PUT enforces for a SuperAdmin target. */
  canEdit: boolean
  /** The page's save is in flight. */
  pending: boolean
  onChange: (screenKey: string, value: AccessLevel | null) => void
  /** Stage "every row back to inherit" — the page's Save is what applies it. */
  onResetAll: () => void
}

/**
 * Personal permission overrides on top of the account's role.
 *
 * COLLAPSED by default: most accounts inherit everything, and a thirteen-row grid opened on every
 * profile would bury the contacts and the login history under a control surface nobody uses daily.
 * The collapsed header still answers the only question that matters at a glance — does this account
 * deviate from its role, and by how much.
 *
 * The expand/collapse is `shared/ui`'s `Accordion` rather than the hand-rolled
 * `useState` + `{expanded && …}` this used to be: same `aria-expanded` disclosure contract, but the
 * panel animates open instead of snapping (and its content goes `inert` while closed, so nothing
 * inside stays tabbable). The state is still owned HERE, controlled, because the trigger is the
 * card's own header row — a `Button` next to the summary text, not the accordion's default
 * full-width bar.
 *
 * Rendered only for someone with `users.Update` (`UserDetailPage` decides): editing overrides is
 * administering the permission system, and the screen registry it is built from is gated too.
 *
 * Presentational since 2026-10-11: the rows are part of the page's draft and are saved by the
 * page's `AdminToolbar` together with the other fields; the error / "applied with a lag" banners
 * live in the page's `message` slot. No Save button down here any more.
 */
export function UserPermissionsCard({
  roleName,
  rows,
  savedOverrideCount,
  canEdit,
  pending,
  onChange,
  onResetAll,
}: UserPermissionsCardProps) {
  const copy = useCopy(rolesCopy)
  const [expanded, setExpanded] = useState(false)

  if (rows === null) {
    return (
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">{copy.overrideTitle}</h3>
          <p className="text-sm text-neutral-500">{copy.overrideLoadFailed}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          {copy.retry}
        </Button>
      </Card>
    )
  }

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-800">{copy.overrideTitle}</h3>
          <p className="text-xs text-neutral-500">
            {copy.overrideSummary(savedOverrideCount, roleName)}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls="user-permissions-panel"
        >
          {expanded ? copy.collapse : copy.expand}
        </Button>
      </div>

      {/*
        Used in CONTROLLED mode with its own trigger switched off (`hidden` ⇒ `display: none` ⇒ out
        of both the render tree and the accessibility tree). The disclosure control is the header
        button above: it predates this card's animation, it sits opposite the summary line the card
        was designed around, and it keeps the section's `<h3>` a real heading — which it could not
        be inside the accordion's `<button>` (a button's content model is phrasing content only).
        Two visible controls for one region would be worse than a vestigial hidden node: two ways to
        close it for a pointer user, two `aria-expanded` states for a screen reader.

        `hidden` beating the trigger's own `flex` is not a coin flip: Tailwind emits `.hidden` AFTER
        `.flex` in its display group, so at equal specificity the later rule wins (verified in the
        built stylesheet, not assumed from class order).
      */}
      <Accordion
        id="user-permissions"
        expanded={expanded}
        trigger={null}
        triggerClassName="hidden"
        contentClassName="flex flex-col gap-3 pt-1"
      >
        <p className="text-xs text-neutral-500">{copy.overrideExplain}</p>
        <p className="text-xs text-neutral-500">{copy.matrixLevelExplain}</p>

        <PermissionMatrix
          mode="override"
          rows={rows}
          caption={copy.overrideCaption(roleName)}
          disabled={!canEdit || pending}
          onChange={onChange}
        />

        {canEdit && (
          <div>
            <Button variant="ghost" size="sm" disabled={pending} onClick={onResetAll}>
              {copy.overrideReset}
            </Button>
          </div>
        )}
      </Accordion>
    </Card>
  )
}
