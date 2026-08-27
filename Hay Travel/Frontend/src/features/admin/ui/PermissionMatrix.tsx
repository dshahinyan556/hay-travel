import type { AccessLevel } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminScreensCopy } from '@/features/admin/lib/adminScreensCopy'
import { PermissionCell } from './PermissionCell'

export interface PermissionMatrixRow {
  screenKey: string
  /** Already localized (`screenLabel`, with the backend's `displayName` as fallback). */
  label: string
  /**
   * Which levels this screen may be set to — `None` plus its applicable actions, ascending
   * (`roleModel.assignableLevels`). The rest are never offered: the backend rejects a level a
   * screen does not support with `400 InvalidPermissionLevel`.
   */
  levels: readonly AccessLevel[]
  /** The granted level. `null` only in `override` mode: "inherit from the role". */
  value: AccessLevel | null
  /** What the ROLE grants. Only meaningful in `override` mode. */
  inherited?: AccessLevel
  /** Warning shown under the row — e.g. "Create granted without read access to the catalogs". */
  hint?: string
}

export interface PermissionMatrixProps {
  mode: 'role' | 'override'
  rows: PermissionMatrixRow[]
  onChange: (screenKey: string, value: AccessLevel | null) => void
  disabled?: boolean
  /** `<caption>` of the table — required: this grid is unreadable without a name. */
  caption: string
}

/**
 * Screens × access level, the one editor shared by the role card and the per-user override block.
 *
 * Purely presentational: it neither loads nor saves, and it does not know which levels a screen
 * supports — that comes in on the row (`roles/lib/roleModel.ts` derives it from `GET api/Screens`,
 * where it can be tested without React and stays identical to the backend's own validation).
 *
 * ONE control per screen since spec 014 §1 — the four independent View/Create/Update/Delete
 * checkboxes are gone, because levels are a ladder (`Update` already includes View and Create) and
 * four boxes could express states the backend does not accept. That also collapsed the grid from
 * five columns to two, which is why the `< sm` card layout is now a plain stacked list rather than
 * a second rendering of the whole action set.
 */
export function PermissionMatrix({
  mode,
  rows,
  onChange,
  disabled = false,
  caption,
}: PermissionMatrixProps) {
  const copy = useCopy(adminScreensCopy)

  return (
    <>
      {/* ≥ sm — the real table. */}
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
              <th scope="col" className="sticky top-0 z-10 bg-neutral-50 px-4 py-2.5 font-semibold">
                {copy.matrix.columnScreen}
              </th>
              <th
                scope="col"
                className="sticky top-0 z-10 w-[220px] bg-neutral-50 px-3 py-2.5 text-right font-semibold"
              >
                {copy.matrix.columnLevel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.screenKey} className="border-t border-neutral-100 align-middle">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-neutral-900">
                  {row.label}
                  {row.hint && <p className="mt-1 text-xs font-normal text-amber-700">{row.hint}</p>}
                </th>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end">
                    <PermissionCell
                      mode={mode}
                      value={row.value}
                      levels={row.levels}
                      inherited={row.inherited}
                      disabled={disabled}
                      label={row.label}
                      onChange={(value) => onChange(row.screenKey, value)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < sm — cards. Same data, no horizontal scrolling: a dropdown cannot sit next to its
          caption at that width without squeezing one of the two, so the control goes under it. */}
      <ul className="flex flex-col gap-2 sm:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.screenKey} className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-sm font-semibold text-neutral-900">{row.label}</p>
            {row.hint && <p className="mt-1 text-xs text-amber-700">{row.hint}</p>}
            <div className="mt-2">
              <PermissionCell
                mode={mode}
                value={row.value}
                levels={row.levels}
                inherited={row.inherited}
                disabled={disabled}
                label={row.label}
                onChange={(value) => onChange(row.screenKey, value)}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
