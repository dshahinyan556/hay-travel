/**
 * State of one role's card: the name, the matrix, dirty tracking and the save call.
 *
 * Shaped after `settings/hooks/useSettingsForm.ts` — local state plus a BASELINE that is replaced
 * by the server's own response on success, so "dirty" always means "differs from what the server
 * has" and no revalidation is needed. No reducer: two operations (edit a cell, edit the name) do
 * not earn an action union.
 */

import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AdminScreen, refreshPermissions, type AccessLevel } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminScreensCopy, screenLabel } from '@/features/admin/lib/adminScreensCopy'
import { createRole, updateRole } from '@/features/admin/api/adminRoles'
import type { RoleInfoModel, ScreenDefinitionModel, ScreenPermissionModel } from '@/features/admin/types/roles'
import type { PermissionMatrixRow } from '@/features/admin/ui/PermissionMatrix'
import {
  applyLevelChange,
  buildRoleMatrixRows,
  catalogDependencyHint,
  isMatrixDirty,
  rowsToPermissions,
} from '../lib/roleModel'
import { rolesCopy, rolesErrorMessage } from '../lib/rolesCopy'

const MAX_NAME_LENGTH = 256

export interface UseRoleFormResult {
  name: string
  setName: (value: string) => void
  rows: PermissionMatrixRow[]
  /** `value` is never `null` in role mode — a role IS the base, there is nothing to inherit from.
   * The signature keeps `null` only because `PermissionMatrix` is shared with the override editor. */
  setLevel: (screenKey: string, value: AccessLevel | null) => void
  /** Whether this role can touch other `CanManageAdmins` roles/accounts. Settable only by
   * SuperAdmin — the form disables the control for anyone else (`RoleForm` decides that). */
  canManageAdmins: boolean
  setCanManageAdmins: (value: boolean) => void
  /** Whether this role may sign in as another account (spec 014 §2.2). Same SuperAdmin-only rule
   * as `canManageAdmins`, and it must be SENT on every save: the backend compares the submitted
   * value against the stored one, so omitting it would read as "revoke it". */
  canImpersonate: boolean
  setCanImpersonate: (value: boolean) => void
  isDirty: boolean
  /** Revert every field to the last saved state (toolbar «Отмена»). */
  reset: () => void
  /** Only shown after the first save attempt — validating as you type is nagging. */
  nameError: string | null
  canSubmit: boolean
  submit: () => void
  isSubmitting: boolean
  error: string | null
  /** Show the "server-side in ≤15 minutes" note once, after a successful save (§0.10). */
  showLagHint: boolean
}

export interface UseRoleFormArgs {
  role: RoleInfoModel | null
  screens: ScreenDefinitionModel[]
  /** Names of all existing roles — a duplicate is caught here instead of costing a round trip. */
  existingNames: string[]
}

export function useRoleForm({ role, screens, existingNames }: UseRoleFormArgs): UseRoleFormResult {
  const navigate = useNavigate()
  const copy = useCopy(rolesCopy)
  const screensCopy = useCopy(adminScreensCopy)

  const [name, setName] = useState(role?.name ?? '')
  const [rows, setRows] = useState<PermissionMatrixRow[]>(() =>
    buildRoleMatrixRows(role, screens, screensCopy),
  )
  const [canManageAdmins, setCanManageAdmins] = useState(role?.canManageAdmins ?? false)
  const [canImpersonate, setCanImpersonate] = useState(role?.canImpersonate ?? false)
  const [baseline, setBaseline] = useState<{
    name: string
    canManageAdmins: boolean
    canImpersonate: boolean
    /** Kept alongside `permissions` so «Отмена» can restore the matrix as-is. */
    rows: PermissionMatrixRow[]
    permissions: ScreenPermissionModel[]
  }>(() => {
    const rows = buildRoleMatrixRows(role, screens, screensCopy)
    return {
      name: role?.name ?? '',
      canManageAdmins: role?.canManageAdmins ?? false,
      canImpersonate: role?.canImpersonate ?? false,
      rows,
      permissions: rowsToPermissions(rows),
    }
  })
  const [attempted, setAttempted] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLagHint, setShowLagHint] = useState(false)

  const permissions = useMemo(() => rowsToPermissions(rows), [rows])
  // Name compared trimmed on BOTH sides — the payload trims, so a stored name with stray edge
  // whitespace must not read as an edit the moment the card opens.
  const isDirty =
    name.trim() !== baseline.name.trim() ||
    canManageAdmins !== baseline.canManageAdmins ||
    canImpersonate !== baseline.canImpersonate ||
    isMatrixDirty(permissions, baseline.permissions)

  const hint = catalogDependencyHint(rows, copy)
  /**
   * Two derivations in one pass: the catalog-dependency warning on the `products` row, and a fresh
   * LABEL for every row. Re-labelling matters because `rows` is state seeded once at mount — without
   * this, switching the panel's language mid-edit would leave the matrix captioned in the previous
   * one until the form remounts.
   */
  const rowsForView = useMemo(
    () =>
      rows.map((row) => {
        const screen = screens.find((candidate) => candidate.key === row.screenKey)
        const label =
          screen === undefined ? row.label : screenLabel(screensCopy, screen.key, screen.displayName)
        return row.screenKey === AdminScreen.Products && hint !== undefined
          ? { ...row, label, hint }
          : { ...row, label }
      }),
    [rows, hint, screens, screensCopy],
  )

  const validateName = useCallback((): string | null => {
    const trimmed = name.trim()
    if (trimmed === '') return copy.nameEmpty
    if (trimmed.length > MAX_NAME_LENGTH) return copy.nameTooLong
    const taken = existingNames.some(
      (existing) => existing.toLowerCase() === trimmed.toLowerCase() && existing !== role?.name,
    )
    return taken ? copy.nameTaken : null
  }, [name, existingNames, role?.name, copy])

  const nameError = attempted ? validateName() : null

  const setLevel = useCallback((screenKey: string, value: AccessLevel | null) => {
    setRows((prev) => applyLevelChange(prev, screenKey, value))
  }, [])

  function reset(): void {
    setName(baseline.name)
    setCanManageAdmins(baseline.canManageAdmins)
    setCanImpersonate(baseline.canImpersonate)
    setRows(baseline.rows)
    setAttempted(false)
    setError(null)
  }

  function submit(): void {
    if (isSubmitting) return
    setAttempted(true)
    if (validateName() !== null) return

    const payload = {
      id: role?.id ?? null,
      name: name.trim(),
      canManageAdmins,
      canImpersonate,
      permissions,
    }

    setSubmitting(true)
    setError(null)
    void (async () => {
      try {
        const saved = role === null ? await createRole(payload) : await updateRole(role.id, payload)

        const savedRows = buildRoleMatrixRows(saved, screens, screensCopy)
        setBaseline({
          name: saved.name,
          canManageAdmins: saved.canManageAdmins,
          canImpersonate: saved.canImpersonate,
          rows: savedRows,
          permissions: rowsToPermissions(savedRows),
        })
        setName(saved.name)
        setCanManageAdmins(saved.canManageAdmins)
        setCanImpersonate(saved.canImpersonate)
        setRows(savedRows)
        setShowLagHint(true)

        // Unconditionally, not "only if this is my own role": `AuthUser` carries no `roleId`, so
        // the frontend cannot tell. One extra GET per administrator action is a cheap price for
        // never hitting the class of bug "I cut my own rights and the panel kept the old buttons".
        await refreshPermissions()

        // `replace`, so Back does not return to `/admin/roles/new` — that URL would rebuild an
        // empty create form for a role that now exists.
        if (role === null) navigate(`/admin/roles/${saved.id}`, { replace: true })
      } catch (err) {
        setError(
          rolesErrorMessage(
            copy,
            err,
            role === null ? copy.errorActions.createRole : copy.errorActions.saveRole,
          ),
        )
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return {
    name,
    setName: (value: string) => {
      setName(value)
      setShowLagHint(false)
    },
    rows: rowsForView,
    setLevel,
    canManageAdmins,
    setCanManageAdmins,
    canImpersonate,
    setCanImpersonate,
    isDirty,
    reset,
    nameError,
    canSubmit: isDirty && !isSubmitting,
    submit,
    isSubmitting,
    error,
    showLagHint,
  }
}
