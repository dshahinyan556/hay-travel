import { Select } from './Select'
import { CloseIcon } from './icons'

export type AccessLevel = 'None' | 'View' | 'Create' | 'Update' | 'Delete'

/** Ascending order — each level implies every one before it (`Update` grants `View` + `Create`
 * too). Exported so a caller resolving "does this level include X" doesn't have to re-type the
 * enum's shape. */
export const ACCESS_LEVEL_ORDER: readonly AccessLevel[] = ['None', 'View', 'Create', 'Update', 'Delete']

function isAccessLevel(value: string): value is AccessLevel {
  return (ACCESS_LEVEL_ORDER as readonly string[]).includes(value)
}

export interface AccessLevelSelectProps {
  id?: string
  value: AccessLevel | null
  onChange: (value: AccessLevel | null) => void
  /** Caption per level, in `ACCESS_LEVEL_ORDER`'s order — no business copy is baked into this
   * component (same rule `OrderStatusBadge`/`AdminSummaryPanel` follow): the caller supplies the
   * localised label for each enum member. */
  labels: Record<AccessLevel, string>
  /**
   * Which levels this particular row may actually be set to, in the order they should be listed.
   * Defaults to all five.
   *
   * Not cosmetic: a screen supports only some of the four actions (calendar has no `Update`,
   * regions have neither `Create` nor `Delete`), and the backend hard-rejects an inapplicable level
   * with `400 InvalidPermissionLevel`. Offering an option that can only fail is worse than not
   * offering it, so the caller passes the screen's own assignable set (`GET api/Screens` → `actions`,
   * plus `None`).
   */
  levels?: readonly AccessLevel[]
  /**
   * Tri-state "override" mode: `value` may be `null`, meaning "no explicit override — follow the
   * role". `null` never renders as a selected option (there is no separate "Inherit" row in the
   * list to land on by mistake) — instead the trigger shows `inheritedLabel` with the same muted/
   * placeholder styling `Select` already uses for its empty state, so an inherited level reads
   * visibly different from one someone explicitly picked. Once a level IS picked, a small reset
   * control next to the trigger clears back to `null`. Requires `inheritedLabel` and `resetLabel`.
   */
  allowInherit?: boolean
  /** What the role actually resolves to, already formatted by the caller (e.g. "Просмотр — по
   * роли"). Shown as the ghost placeholder while `value` is `null`. Required when `allowInherit`. */
  inheritedLabel?: string
  /** Accessible name + tooltip of the small "back to inherited" button shown once a level has been
   * explicitly picked. Required when `allowInherit`. */
  resetLabel?: string
  /**
   * Renders a plain "—" instead of a control, for a row/column combination this level structurally
   * does not apply to (e.g. a screen with no Delete action) — matching the dash
   * `features/admin/ui/PermissionMatrix.tsx` already uses for the same situation. NOT the same as
   * `disabled`: a disabled control still says "there is a value here, you may not change it right
   * now", this says the value has no meaning at all.
   */
  notApplicable?: boolean
  /** Optional tooltip/accessible text for the `notApplicable` dash. */
  notApplicableLabel?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

/**
 * Single dropdown standing in for what used to be four independent View/Create/Update/Delete
 * checkboxes (`PermissionCell`/`PermissionMatrix` in `features/admin/ui/`) — the new backend
 * `AccessLevel` enum is ONE value per screen, each level implying everything below it, so the UI
 * collapses to one control instead of four.
 *
 * Wired in through `features/admin/ui/PermissionCell`, which is now a thin adapter over this
 * component: it supplies the localized level captions and, in `override` mode, the "по роли: …"
 * ghost text. Both consumers of the matrix (`RoleForm`, `UserPermissionsCard`) go through that.
 *
 * Built on top of `Select` rather than a bespoke combobox — same trigger/listbox chrome, keyboard
 * handling and mobile `Sheet` every other dropdown in the app already has, for free. The "back to
 * inherited" affordance is a small icon button next to it (mirrors `HelpButton`'s close-icon
 * styling), the same "reset next to the control it overrides" shape as VS-Code-style settings
 * overrides — chosen over an in-list "Inherit" row because what "inherit" resolves to changes per
 * role and needs to show dynamically resolved text, not a static option label.
 */
export function AccessLevelSelect({
  id,
  value,
  onChange,
  labels,
  levels = ACCESS_LEVEL_ORDER,
  allowInherit = false,
  inheritedLabel,
  resetLabel,
  notApplicable = false,
  notApplicableLabel,
  disabled = false,
  className = '',
  triggerClassName,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: AccessLevelSelectProps) {
  if (notApplicable) {
    return (
      <span className={`text-neutral-300 ${className}`} title={notApplicableLabel}>
        —
      </span>
    )
  }

  const options = levels.map((level) => ({ value: level, label: labels[level] }))

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Select
        id={id}
        surface="admin"
        value={value ?? ''}
        onChange={(next) => {
          if (isAccessLevel(next)) onChange(next)
        }}
        options={options}
        placeholder={allowInherit ? inheritedLabel : undefined}
        disabled={disabled}
        triggerClassName={triggerClassName}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      />
      {allowInherit && value !== null && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={resetLabel}
          title={resetLabel}
          className="icon-press -m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-neutral-400 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  )
}
