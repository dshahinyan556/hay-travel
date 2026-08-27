import { Link, redirect, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { DataEntryScreenLayout } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getStoredLocale } from '@/shared/lib/locale'
import { AdminScreen, canView, ensurePermissionsReady } from '@/shared/auth'
import { getRoles, getScreens } from '@/features/admin/api/adminRoles'
import { RoleForm } from './components/RoleForm'
import { rolesCopy } from './lib/rolesCopy'

/**
 * One role's card, and the create form.
 *
 * There is no separate `/admin/roles/new` route: creating IS this screen with `id = 'new'`, because
 * the only difference is that no role is loaded. A second route would duplicate the whole form for
 * that one distinction.
 *
 * The role itself comes out of `GET api/Roles` rather than a by-id endpoint — there is none, and
 * with roles numbering in the single digits there does not need to be. The same call supplies
 * `existingNames`, which the form needs anyway to reject a duplicate before sending it.
 */
export async function roleDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Roles)) throw redirect('/admin')

  // A loader runs outside React, so there is no `useCopy` here — the stored locale is read
  // directly, per `shared/i18n/defineCopy.ts`'s rule 3.
  const copy = rolesCopy(getStoredLocale())

  const isNew = params.id === 'new'
  const id = isNew ? null : Number(params.id)
  if (!isNew && (id === null || !Number.isInteger(id) || id <= 0)) {
    throw new Response(copy.errorInvalidId, { status: 400 })
  }

  const [roles, screens] = await Promise.all([getRoles(), getScreens()])
  const role = isNew ? null : (roles.find((candidate) => candidate.id === id) ?? null)
  if (!isNew && role === null) throw new Response(copy.errorNotFound, { status: 404 })

  return { role, screens, existingNames: roles.map((candidate) => candidate.name) }
}

export function RoleDetailPage() {
  const { role, screens, existingNames } = useLoaderData<typeof roleDetailLoader>()
  const copy = useCopy(rolesCopy)

  /**
   * Template A — «Экран ввода данных» (`DataEntryScreenLayout`): one hero record, breadcrumbs →
   * title/subtitle → control zone → message slot → body.
   *
   * No `controlZone`: this screen's Save/Cancel still live at the BOTTOM of `RoleForm`, next to the
   * form state that owns them. Lifting them into an `AdminToolbar` means lifting `useRoleForm` into
   * the page, which the approved template proposal itself calls a separate task ("у них своя кнопка
   * сохранения внизу и нет тулбара… приведение их к шаблону A — отдельная задача"). The chrome above
   * the body is what this pass aligns.
   *
   * The error/lag banners stay inside `RoleForm` for the same reason — they are the form's own
   * state — rather than being threaded up into the layout's `message` slot.
   */
  return (
    <DataEntryScreenLayout
      breadcrumbs={
        <>
          <Link to="/admin/roles" className="transition-colors hover:text-neutral-800">
            {copy.title}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{role?.name ?? copy.newRoleTitle}</span>
        </>
      }
      breadcrumbsLabel={copy.breadcrumbAria}
      title={role?.name ?? copy.newRoleTitle}
      subtitle={copy.subtitle}
    >
      {/* Keyed by id so navigating between two roles rebuilds the form state instead of carrying
          the previous role's edits over — the same reasoning as `UserDetailPage`/`TourEditPage`. */}
      <RoleForm key={role?.id ?? 'new'} role={role} screens={screens} existingNames={existingNames} />
    </DataEntryScreenLayout>
  )
}
