import { AccessLevelSelect } from '@/shared/ui'
import { AccessLevel } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminScreensCopy } from '@/features/admin/lib/adminScreensCopy'
import { levelName, levelOfName } from '@/features/admin/roles/lib/roleModel'

export interface PermissionCellProps {
  mode: 'role' | 'override'
  /** The granted level. `null` exists only in `override` mode and means "inherit from the role" —
   * a role IS the base, there is nothing above it to inherit from. */
  value: AccessLevel | null
  /** Which levels this screen may be set to (`None` + its applicable actions). */
  levels: readonly AccessLevel[]
  /** What the ROLE grants — shown as the ghost placeholder while the row says "inherit".
   * `override` mode only. */
  inherited?: AccessLevel
  disabled?: boolean
  /** Accessible name of the control: the screen's caption. Always set; in the table layout the
   * visible caption is a row header, which a screen reader does not read per cell. */
  label: string
  onChange: (value: AccessLevel | null) => void
}

/**
 * One cell of `PermissionMatrix` — a thin adapter over `shared/ui`'s `AccessLevelSelect`.
 *
 * It exists (rather than the matrix rendering the shared control directly) for exactly one reason:
 * `AccessLevelSelect` deliberately carries no business copy, and the wire enum it does NOT speak
 * (it has its own `'None' | 'View' | …` union). Both of those translations belong to the admin
 * feature, and doing them here keeps them out of both the shared primitive and the matrix's layout
 * code.
 *
 * The four independent checkboxes this used to be are gone with the 4-bool contract (spec 014 §1):
 * levels are a ladder, so there is nothing left for a per-action control to express. In `override`
 * mode the tri-state is preserved — but as `AccessLevelSelect`'s `null` + ghost placeholder
 * ("по роли: Просмотр") plus a reset button, not as a cycling `aria-checked="mixed"` box.
 */
export function PermissionCell({
  mode,
  value,
  levels,
  inherited = AccessLevel.None,
  disabled = false,
  label,
  onChange,
}: PermissionCellProps) {
  const copy = useCopy(adminScreensCopy)
  const isOverride = mode === 'override'

  // Only `None` is assignable: the registry reports a screen with no applicable actions at all.
  // A dropdown offering a single option is a control with no decision in it, so the row reads as
  // the same "—" the old matrix used for an inapplicable action.
  if (levels.length <= 1) {
    return (
      <AccessLevelSelect
        value={null}
        onChange={() => undefined}
        labels={copy.matrix.levels}
        notApplicable
        notApplicableLabel={copy.matrix.notApplicable}
        aria-label={label}
      />
    )
  }

  return (
    <AccessLevelSelect
      value={value === null ? null : levelName(value)}
      levels={levels.map(levelName)}
      labels={copy.matrix.levels}
      disabled={disabled}
      allowInherit={isOverride}
      inheritedLabel={isOverride ? copy.matrix.inheritedLevel(copy.matrix.levels[levelName(inherited)]) : undefined}
      resetLabel={isOverride ? copy.matrix.resetToInherited : undefined}
      aria-label={label}
      // `triggerClassName` REPLACES the default shape (see `Select`), so the default padding and
      // radius are restated here; `min-w` is the only actual change — without it every row's
      // dropdown would be as wide as its own longest caption, and the column would look ragged.
      triggerClassName="rounded-lg px-3 py-2 min-w-[168px]"
      onChange={(next) => onChange(next === null ? null : levelOfName(next))}
    />
  )
}
