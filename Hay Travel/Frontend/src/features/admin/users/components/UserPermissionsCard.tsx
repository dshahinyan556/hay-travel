import { useMemo, useState } from 'react'
import { Accordion, Button, Card } from '@/shared/ui'
import { refreshPermissions, type AccessLevel } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminScreensCopy } from '@/features/admin/lib/adminScreensCopy'
import { putUserPermissionOverrides } from '@/features/admin/api/adminUsers'
import { PermissionMatrix, type PermissionMatrixRow } from '@/features/admin/ui/PermissionMatrix'
import type {
  ScreenDefinitionModel,
  ScreenOverrideModel,
  ScreenPermissionModel,
} from '@/features/admin/types/roles'
import {
  applyLevelChange,
  areOverridesDirty,
  buildOverrideMatrixRows,
  clearAllOverrides,
  countOverrides,
  rowsToOverrides,
} from '@/features/admin/roles/lib/roleModel'
import { rolesCopy, rolesErrorMessage } from '@/features/admin/roles/lib/rolesCopy'

export interface UserPermissionsCardProps {
  userId: number
  /** Role name — for the "inherits from «X»" summary. */
  roleName: string
  /** The user's ROLE matrix, or `null` when it could not be loaded. */
  rolePermissions: ScreenPermissionModel[] | null
  overrides: ScreenOverrideModel[] | null
  screens: ScreenDefinitionModel[] | null
  /** `users.Update` — without it the block is readable but not editable. */
  canEdit: boolean
  /** Re-run the page's loader after a successful save. */
  onSaved: () => void
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
 */
export function UserPermissionsCard({
  userId,
  roleName,
  rolePermissions,
  overrides,
  screens,
  canEdit,
  onSaved,
}: UserPermissionsCardProps) {
  const copy = useCopy(rolesCopy)
  const screensCopy = useCopy(adminScreensCopy)
  const [expanded, setExpanded] = useState(false)
  const failed = screens === null || rolePermissions === null || overrides === null

  const baseline = useMemo(() => overrides ?? [], [overrides])
  const initialRows = useMemo(
    () =>
      screens === null || rolePermissions === null
        ? []
        : buildOverrideMatrixRows(screens, rolePermissions, baseline, screensCopy),
    [screens, rolePermissions, baseline, screensCopy],
  )

  const [rows, setRows] = useState<PermissionMatrixRow[]>(initialRows)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLagHint, setShowLagHint] = useState(false)

  const draft = useMemo(() => rowsToOverrides(rows), [rows])
  const isDirty = areOverridesDirty(draft, baseline)

  function setLevel(screenKey: string, value: AccessLevel | null) {
    setShowLagHint(false)
    setRows((prev) => applyLevelChange(prev, screenKey, value))
  }

  async function save() {
    if (isSubmitting) return
    setSubmitting(true)
    setError(null)
    try {
      // Only the rows that actually deviate travel: the endpoint reads an absent key as "drop the
      // override", so sending an inherited row would ask it to store nothing.
      await putUserPermissionOverrides({ userId, overrides: draft })
      setShowLagHint(true)
      // The admin may have just overridden THEMSELVES — re-read before the panel keeps drawing
      // controls their own new set no longer allows.
      await refreshPermissions()
      onSaved()
    } catch (err) {
      setError(rolesErrorMessage(copy, err, copy.errorActions.saveOverrides))
    } finally {
      setSubmitting(false)
    }
  }

  if (failed) {
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
            {copy.overrideSummary(countOverrides(baseline), roleName)}
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

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        {showLagHint && !error && (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {copy.permissionLag}
          </p>
        )}

        <PermissionMatrix
          mode="override"
          rows={rows}
          caption={copy.overrideCaption(roleName)}
          disabled={!canEdit || isSubmitting}
          onChange={setLevel}
        />

        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto"
              disabled={isSubmitting}
              onClick={() => {
                setShowLagHint(false)
                setRows((prev) => clearAllOverrides(prev))
              }}
            >
              {copy.overrideReset}
            </Button>
            <Button size="sm" disabled={!isDirty || isSubmitting} onClick={() => void save()}>
              {isSubmitting ? copy.saving : copy.save}
            </Button>
          </div>
        )}
      </Accordion>
    </Card>
  )
}
